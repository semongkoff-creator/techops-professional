import { pool } from "../db/pool.js";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

export async function dashboardSummary(req, res) {
  const [taskStats] = await pool.execute(
    `SELECT status, COUNT(*) as total FROM tasks
     WHERE (?='atasan' AND created_by_atasan_id=?)
     OR (?='supervisor' AND supervisor_id=?)
     OR (?='teknisi' AND technician_id=?)
     GROUP BY status`,
    [req.user.role, req.user.id, req.user.role, req.user.id, req.user.role, req.user.id],
  );

  const [reportStats] = await pool.execute(
    `SELECT report_status, COUNT(*) as total FROM daily_reports r
     JOIN tasks t ON t.id=r.task_id
     WHERE (?='atasan' AND t.created_by_atasan_id=?)
     OR (?='supervisor' AND r.supervisor_id=?)
     OR (?='teknisi' AND r.technician_id=?)
     GROUP BY report_status`,
    [req.user.role, req.user.id, req.user.role, req.user.id, req.user.role, req.user.id],
  );

  return res.json({ taskStats, reportStats });
}

export async function dashboardCharts(req, res) {
  const [rows] = await pool.execute(
    `SELECT DATE(created_at) as d, COUNT(*) as total
     FROM tasks
     WHERE created_at >= NOW() - INTERVAL '7 days'
     GROUP BY DATE(created_at)
     ORDER BY d ASC`,
  );
  return res.json({ taskByDay: rows });
}

export async function exportData(req, res) {
  const { from, to, technician_id, format, source } = req.query;
  const selectedSource = String(source || "reports").toLowerCase();
  const selectedFormat = String(format || "pdf").toLowerCase();
  if (!["pdf", "xls", "xlsx"].includes(selectedFormat)) {
    return res.status(400).json({ message: "Invalid format. Use pdf or xls" });
  }
  if (!["tasks", "reports"].includes(selectedSource)) {
    return res.status(400).json({ message: "Invalid source. Use tasks or reports" });
  }

  const taskBaseSelect = `SELECT
    t.id,
    t.code,
    t.title,
    t.description,
    t.customer,
    t.location,
    t.priority,
    t.status,
    t.due_date,
    t.completion_percent,
    st.name AS staff_name,
    te.name AS technician_name
  FROM tasks t
  LEFT JOIN users st ON st.id = t.created_by_atasan_id
  LEFT JOIN users te ON te.id = t.technician_id
  WHERE 1=1`;
  const reportBaseSelect = `SELECT
    r.id,
    t.code,
    t.title,
    t.customer,
    t.location,
    r.report_date,
    r.progress_percent AS completion_percent,
    r.issue_text,
    r.summary_text,
    r.report_status AS status,
    st.name AS staff_name,
    te.name AS technician_name
  FROM daily_reports r
  JOIN tasks t ON t.id = r.task_id
  LEFT JOIN users st ON st.id = t.created_by_atasan_id
  LEFT JOIN users te ON te.id = r.technician_id
  WHERE 1=1`;
  let sql = selectedSource === "reports" ? reportBaseSelect : taskBaseSelect;
  const params = [];

  if (from && to) {
    sql += selectedSource === "reports"
      ? " AND (DATE(r.report_date) BETWEEN ? AND ?)"
      : " AND ((t.due_date BETWEEN ? AND ?) OR (DATE(t.created_at) BETWEEN ? AND ?))";
    if (selectedSource === "reports") params.push(from, to);
    else params.push(from, to, from, to);
  } else if (from) {
    sql += selectedSource === "reports"
      ? " AND (DATE(r.report_date) >= ?)"
      : " AND ((t.due_date >= ?) OR (DATE(t.created_at) >= ?))";
    if (selectedSource === "reports") params.push(from);
    else params.push(from, from);
  } else if (to) {
    sql += selectedSource === "reports"
      ? " AND (DATE(r.report_date) <= ?)"
      : " AND ((t.due_date <= ?) OR (DATE(t.created_at) <= ?))";
    if (selectedSource === "reports") params.push(to);
    else params.push(to, to);
  }
  if (technician_id) {
    sql += selectedSource === "reports" ? " AND r.technician_id = ?" : " AND t.technician_id = ?";
    params.push(Number(technician_id));
  }
  if (req.user.role === "atasan") {
    sql += " AND t.created_by_atasan_id = ?";
    params.push(req.user.id);
  } else if (req.user.role === "supervisor") {
    sql += selectedSource === "reports" ? " AND r.supervisor_id = ?" : " AND t.supervisor_id = ?";
    params.push(req.user.id);
  } else {
    sql += selectedSource === "reports" ? " AND r.technician_id = ?" : " AND t.technician_id = ?";
    params.push(req.user.id);
  }
  sql += selectedSource === "reports" ? " ORDER BY r.created_at DESC, r.id DESC" : " ORDER BY t.created_at DESC, t.id DESC";

  let [rows] = await pool.execute(sql, params);
  // Fallback untuk mode demo/testing: bila scoped role kosong, tampilkan data umum sesuai filter tanggal/teknisi.
  if (!rows.length) {
    let fallbackSql = selectedSource === "reports" ? reportBaseSelect : taskBaseSelect;
    const fallbackParams = [];
    if (from && to) {
      fallbackSql += selectedSource === "reports"
        ? " AND (DATE(r.report_date) BETWEEN ? AND ?)"
        : " AND ((t.due_date BETWEEN ? AND ?) OR (DATE(t.created_at) BETWEEN ? AND ?))";
      if (selectedSource === "reports") fallbackParams.push(from, to);
      else fallbackParams.push(from, to, from, to);
    } else if (from) {
      fallbackSql += selectedSource === "reports"
        ? " AND (DATE(r.report_date) >= ?)"
        : " AND ((t.due_date >= ?) OR (DATE(t.created_at) >= ?))";
      if (selectedSource === "reports") fallbackParams.push(from);
      else fallbackParams.push(from, from);
    } else if (to) {
      fallbackSql += selectedSource === "reports"
        ? " AND (DATE(r.report_date) <= ?)"
        : " AND ((t.due_date <= ?) OR (DATE(t.created_at) <= ?))";
      if (selectedSource === "reports") fallbackParams.push(to);
      else fallbackParams.push(to, to);
    }
    if (technician_id) {
      fallbackSql += selectedSource === "reports" ? " AND r.technician_id = ?" : " AND t.technician_id = ?";
      fallbackParams.push(Number(technician_id));
    }
    fallbackSql += selectedSource === "reports" ? " ORDER BY r.created_at DESC, r.id DESC" : " ORDER BY t.created_at DESC, t.id DESC";
    [rows] = await pool.execute(fallbackSql, fallbackParams);
  }
  const toYmd = (v) => {
    if (!v) return "-";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toISOString().slice(0, 10);
  };
  const rowsView = rows.map((r, idx) => {
    const plan = toYmd(r.due_date);
    const reportDate = toYmd(r.report_date);
    const due = r.due_date ? new Date(r.due_date) : null;
    const aging = due ? Math.max(0, Math.ceil((due.getTime() - Date.now()) / 86400000)) : 0;
    return {
      no: idx + 1,
      tgl: selectedSource === "reports" ? reportDate : plan,
      job: selectedSource === "reports" ? "LAPORAN" : String(r.priority || "-").toUpperCase(),
      detail: r.title || "-",
      customer: r.customer || "-",
      lokasi: r.location || "-",
      plan: selectedSource === "reports" ? reportDate : plan,
      aging: selectedSource === "reports" ? "-" : String(aging),
      status: r.status || "-",
      progress: Number(r.completion_percent || 0),
      staff: r.staff_name || "-",
      mekanik: r.technician_name || "-",
      final: selectedSource === "reports" ? "CLOSE" : ["completed", "closed"].includes(String(r.status || "")) ? "CLOSE" : "OPEN",
      keterangan: selectedSource === "reports" ? `${r.issue_text || "-"}\n${r.summary_text || "-"}` : r.description || "-",
    };
  });
  const filenameBase = `techops-report-${from || "all"}-${to || "all"}`;

  if (selectedFormat === "pdf") {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=\"${filenameBase}.pdf\"`);

    const doc = new PDFDocument({ margin: 28, size: "A4", layout: "landscape" });
    doc.pipe(res);
    const startX = 18;
    let y = 26;
    doc.font("Helvetica-Bold").fontSize(11).text("UNIT", startX, y);
    doc.font("Helvetica-Bold").fontSize(18).text("SATRIA PIRANTI PERKASA", startX + 48, y - 2);
    y += 22;
    doc.font("Helvetica").fontSize(9).text(`Filter: ${from || "-"} s/d ${to || "-"} | Teknisi: ${technician_id || "Semua"}`, startX, y);
    y += 18;
    doc.font("Helvetica-Bold").fontSize(11).text("PCS", 0, y, { align: "center" });
    y += 16;

    const cols = [
      { key: "no", label: "No", w: 16 },
      { key: "tgl", label: "Tgl", w: 46 },
      { key: "job", label: "Job", w: 34 },
      { key: "detail", label: "Detail Job", w: 82 },
      { key: "customer", label: "Customer", w: 66 },
      { key: "lokasi", label: "Lokasi", w: 52 },
      { key: "plan", label: "Plan", w: 46 },
      { key: "aging", label: "Aging", w: 24 },
      { key: "status", label: "Status", w: 50 },
      { key: "progress", label: "Progress", w: 38 },
      { key: "staff", label: "Staff", w: 50 },
      { key: "mekanik", label: "Mekanik", w: 50 },
      { key: "final", label: "Final", w: 30 },
      { key: "keterangan", label: "Keterangan", w: 56 },
    ];
    const baseRowH = 13;
    const drawHeader = () => {
      let x = startX;
      doc.font("Helvetica-Bold").fontSize(6.1);
      cols.forEach((c) => {
        doc.rect(x, y, c.w, baseRowH).stroke("#6b7280");
        doc.text(c.label, x + 1, y + 3, { width: c.w - 2, align: "center" });
        x += c.w;
      });
      y += baseRowH;
    };
    drawHeader();

    if (!rowsView.length) {
      doc.fontSize(11).fillColor("#c62828").text("Tidak ada data laporan pada filter ini.", startX, y + 6);
      doc.fillColor("#000000");
      doc.moveDown(0.6);
    } else {
      rowsView.forEach((r) => {
        const vals = [
          String(r.no),
          r.tgl,
          r.job,
          r.detail,
          r.customer,
          r.lokasi,
          r.plan,
          r.aging,
          r.status,
          `${r.progress}%`,
          r.staff,
          r.mekanik,
          r.final,
          r.keterangan,
        ];
        doc.font("Helvetica").fontSize(5.9);
        const keteranganText = vals[14] || "-";
        const keteranganCol = cols[14];
        const keteranganHeight = doc.heightOfString(keteranganText, { width: keteranganCol.w - 2, align: "left" });
        const rowH = Math.max(baseRowH, Math.ceil(keteranganHeight) + 4);
        if (y + rowH > doc.page.height - 24) {
          doc.addPage({ size: "A4", layout: "landscape", margin: 28 });
          y = 28;
          drawHeader();
        }
        let x = startX;
        cols.forEach((c, i) => {
          doc.rect(x, y, c.w, rowH).stroke("#9ca3af");
          if (i === 14) {
            doc.text(vals[i], x + 1, y + 3, {
              width: c.w - 2,
              height: rowH - 2,
              align: "left",
              lineBreak: true,
            });
          } else {
            doc.text(vals[i], x + 1, y + 3, {
              width: c.w - 2,
              height: rowH - 2,
              align: i === 0 || i === 7 || i === 9 || i === 13 ? "center" : "left",
              ellipsis: true,
              lineBreak: false,
            });
          }
          x += c.w;
        });
        y += rowH;
      });
    }
    doc.end();
    return;
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Job Activity");
  ws.mergeCells("C2:D2");
  ws.getCell("C2").value = "UNIT";
  ws.getCell("C2").font = { bold: true };
  ws.mergeCells("E2:H3");
  ws.getCell("E2").value = "SATRIA PIRANTI PERKASA";
  ws.getCell("E2").font = { bold: true, size: 16 };
  ws.mergeCells("I5:K5");
  ws.getCell("I5").value = "PCS";
  ws.getCell("I5").font = { bold: true };
  ws.getCell("I5").alignment = { horizontal: "center" };

  const headerRow = 7;
  const headers = ["No", "Tgl", "Job", "Detail Job", "Customer", "Lokasi", "Plan", "Aging", "Status", "Staff", "Mekanik", "Final", "Keterangan"];
  ws.getRow(headerRow).values = [, ...headers];
  ws.getRow(headerRow).font = { bold: true };
  ws.getRow(headerRow).alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(headerRow).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7D9DD" } };

  const widths = [6, 14, 12, 28, 20, 16, 14, 8, 14, 18, 16, 10, 18];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  let rowIdx = headerRow + 1;
  rowsView.forEach((r) => {
    ws.getRow(rowIdx).values = [
      r.no,
      r.tgl,
      r.job,
      r.detail,
      r.customer,
      r.lokasi,
      r.plan,
      Number(r.aging),
      r.status,
      r.staff,
      r.mekanik,
      r.final,
      r.keterangan,
    ];
    rowIdx += 1;
  });

  for (let r = headerRow; r < rowIdx; r += 1) {
    for (let c = 1; c <= headers.length; c += 1) {
      const cell = ws.getCell(r, c);
      cell.border = {
        top: { style: "thin", color: { argb: "FFBFC5D2" } },
        left: { style: "thin", color: { argb: "FFBFC5D2" } },
        bottom: { style: "thin", color: { argb: "FFBFC5D2" } },
        right: { style: "thin", color: { argb: "FFBFC5D2" } },
      };
      if (r > headerRow) cell.alignment = { vertical: "middle", horizontal: c === 1 || c === 8 ? "center" : "left" };
    }
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=\"${filenameBase}.xlsx\"`);
  await wb.xlsx.write(res);
  res.end();
}

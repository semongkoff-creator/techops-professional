import { pool } from "../db/pool.js";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import XLSX from "xlsx";

function loadLogoBuffer() {
  const candidates = [
    path.resolve(process.cwd(), "public/assets/logo-satria.jpg"),
    path.resolve(process.cwd(), "../public/assets/logo-satria.jpg"),
    path.resolve(process.cwd(), "assets/logo-satria.jpg"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p);
  }
  return null;
}

function loadReportTemplatePath() {
  const candidates = [
    path.resolve(process.cwd(), "server/assets/Laporan-Teknisi-Formatted.xlsx"),
    path.resolve(process.cwd(), "assets/Laporan-Teknisi-Formatted.xlsx"),
    path.resolve(process.cwd(), "../server/assets/Laporan-Teknisi-Formatted.xlsx"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

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
     LEFT JOIN tasks t ON t.id=r.task_id
     WHERE (?='atasan' AND COALESCE(t.created_by_atasan_id, r.created_by_staff_id)=?)
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
    t.documentation_image_url,
    st.name AS staff_name,
    te.name AS technician_name
  FROM tasks t
  LEFT JOIN users st ON st.id = t.created_by_atasan_id
  LEFT JOIN users te ON te.id = t.technician_id
  WHERE 1=1`;
  const reportBaseSelect = `SELECT
    r.id,
    COALESCE(t.code, r.task_code_ref) AS code,
    COALESCE(t.title, r.task_title_snapshot) AS title,
    COALESCE(t.customer, r.customer_snapshot) AS customer,
    COALESCE(t.location, r.location_snapshot) AS location,
    r.report_date,
    r.progress_percent AS completion_percent,
    r.issue_text,
    r.summary_text,
    t.documentation_image_url,
    r.report_status AS status,
    COALESCE(st.name, st_ref.name) AS staff_name,
    te.name AS technician_name
  FROM daily_reports r
  LEFT JOIN tasks t ON t.id = r.task_id
  LEFT JOIN users st ON st.id = t.created_by_atasan_id
  LEFT JOIN users st_ref ON st_ref.id = r.created_by_staff_id
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
    sql += " AND COALESCE(t.created_by_atasan_id, r.created_by_staff_id) = ?";
    params.push(req.user.id);
  } else if (req.user.role === "supervisor") {
    sql += selectedSource === "reports" ? " AND r.supervisor_id = ?" : " AND t.supervisor_id = ?";
    params.push(req.user.id);
  } else {
    sql += selectedSource === "reports" ? " AND r.technician_id = ?" : " AND t.technician_id = ?";
    params.push(req.user.id);
  }
  sql += selectedSource === "reports"
    ? " ORDER BY r.created_at DESC, r.id DESC"
    : " ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date ASC, t.created_at ASC, t.id ASC";

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
    fallbackSql += selectedSource === "reports"
      ? " ORDER BY r.created_at DESC, r.id DESC"
      : " ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date ASC, t.created_at ASC, t.id ASC";
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
      code: r.code || "-",
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
      dokumentasi: r.documentation_image_url || "-",
      summary_text: r.summary_text || "",
      issue_text: r.issue_text || "",
    };
  });
  const parseSummaryBlock = (summary) => {
    const text = String(summary || "");
    const lines = text.split("\n").map((s) => s.trim()).filter(Boolean);
    const take = (label) => {
      const found = lines.find((s) => s.toLowerCase().startsWith(`${label.toLowerCase()}:`));
      return found ? found.split(":").slice(1).join(":").trim() || "-" : "-";
    };
    const unitLines = lines.filter((s) => /^\d+\.\s+Kode Unit:/i.test(s));
    const units = unitLines.map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      const first = parts.shift() || "";
      const unit_code = first.replace(/^\d+\.\s+Kode Unit:\s*/i, "").trim() || "-";
      const get = (label) => parts.find((p) => p.toLowerCase().startsWith(label.toLowerCase()))?.split(":").slice(1).join(":").trim() || "-";
      return {
        unit_code,
        hour_meter: get("Hour Meter"),
        merk: get("Merk"),
        tipe: get("Tipe"),
        trouble: get("Trouble"),
        action: get("Action"),
        sparepart: get("Sparepart"),
        hasil: get("Hasil"),
      };
    });
    const ringkasan = text.includes("Nama Mekanik:") ? text.slice(0, text.indexOf("Nama Mekanik:")).trim() : text.trim();
    return {
      nama_mekanik: take("Nama Mekanik"),
      customer_pt: take("Customer / PT"),
      ringkasan: ringkasan || "-",
      units,
    };
  };
  const reportExpandedRows = selectedSource === "reports"
    ? rowsView.flatMap((row) => {
      const parsed = parseSummaryBlock(row.summary_text);
      const units = parsed.units.length ? parsed.units : [{
        unit_code: "-", hour_meter: "-", merk: "-", tipe: "-", trouble: "-", action: "-", sparepart: "-", hasil: String(row.status || "-"),
      }];
      return units.map((u) => ({
        ...row,
        parsed,
        unit: u,
        export_customer: parsed.customer_pt !== "-" ? parsed.customer_pt : (row.customer || "-"),
        export_mekanik: parsed.nama_mekanik !== "-" ? parsed.nama_mekanik : (row.mekanik || "-"),
      }));
    })
    : [];
  const filenameBase = `techops-report-${from || "all"}-${to || "all"}`;

  if (selectedFormat === "pdf") {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=\"${filenameBase}.pdf\"`);

    const doc = new PDFDocument({ margin: 28, size: "A4", layout: "landscape" });
    doc.pipe(res);
    const startX = 14;
    let y = 16;
    const logoBuffer = loadLogoBuffer();
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, startX + 92, y - 2, { fit: [210, 48], align: "left", valign: "center" });
      } catch {
        // ignore logo failure, keep export running
      }
    }
    doc.font("Helvetica-Bold").fontSize(10).text("UNIT", startX, y + 10);
    y += 30;
    doc.font("Helvetica").fontSize(9).text(`Filter: ${from || "-"} s/d ${to || "-"} | Teknisi: ${technician_id || "Semua"}`, startX, y);
    y += 14;
    doc.rect(startX, y, 810, 14).fill("#f7d9dd");
    doc.fillColor("#000").font("Helvetica-Bold").fontSize(10).text("PCS", startX, y + 3, { width: 805, align: "center" });
    y += 16;

    const cols = selectedSource === "reports" ? [
      { key: "no", label: "No", w: 16 },
      { key: "tgl", label: "Tgl", w: 46 },
      { key: "job", label: "Job", w: 34 },
      { key: "code", label: "Task ID", w: 58 },
      { key: "customer", label: "Customer", w: 68 },
      { key: "mekanik", label: "Mekanik", w: 56 },
      { key: "unit_code", label: "Kode Unit", w: 54 },
      { key: "hour_meter", label: "Hour Meter", w: 50 },
      { key: "merk", label: "Merk", w: 44 },
      { key: "tipe", label: "Tipe", w: 44 },
      { key: "trouble", label: "Trouble", w: 62 },
      { key: "action", label: "Action", w: 62 },
      { key: "sparepart", label: "Sparepart", w: 54 },
      { key: "hasil", label: "Hasil", w: 62 },
    ] : [
      { key: "no", label: "No", w: 18 },
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
      { key: "keterangan", label: "Keterangan", w: 52 },
      { key: "dokumentasi", label: "Dokumentasi", w: 62 },
    ];
    const baseRowH = selectedSource === "reports" ? 13 : 14;
    const drawHeader = () => {
      let x = startX;
      doc.font("Helvetica-Bold").fontSize(selectedSource === "reports" ? 6.1 : 6.6);
      cols.forEach((c) => {
        doc.rect(x, y, c.w, baseRowH).stroke("#6b7280");
        doc.text(c.label, x + 1, y + 3, { width: c.w - 2, align: "center" });
        x += c.w;
      });
      y += baseRowH;
    };
    drawHeader();

    const pdfRows = selectedSource === "reports"
      ? reportExpandedRows.map((r, idx) => ({
        no: idx + 1,
        tgl: r.tgl,
        job: r.job,
        code: r.code || "-",
        customer: r.export_customer || "-",
        mekanik: r.export_mekanik || "-",
        unit_code: r.unit.unit_code || "-",
        hour_meter: r.unit.hour_meter || "-",
        merk: r.unit.merk || "-",
        tipe: r.unit.tipe || "-",
        trouble: r.unit.trouble || "-",
        action: r.unit.action || "-",
        sparepart: r.unit.sparepart || "-",
        hasil: r.unit.hasil || "-",
      }))
      : rowsView;
    if (!pdfRows.length) {
      doc.fontSize(11).fillColor("#c62828").text("Tidak ada data laporan pada filter ini.", startX, y + 6);
      doc.fillColor("#000000");
      doc.moveDown(0.6);
    } else {
      pdfRows.forEach((r) => {
        const vals = cols.map((c) => {
          const v = r[c.key];
          if (c.key === "progress") return `${Number(v || 0)}%`;
          return String(v ?? "-");
        });
        doc.font("Helvetica").fontSize(selectedSource === "reports" ? 5.9 : 6.2);
        const wrapIndex = selectedSource === "reports" ? cols.findIndex((c) => c.key === "trouble") : 13;
        const wrapText = vals[wrapIndex] || "-";
        const wrapCol = cols[wrapIndex];
        const wrapHeight = doc.heightOfString(wrapText, { width: wrapCol.w - 2, align: "left" });
        const rowH = Math.max(baseRowH, Math.ceil(wrapHeight) + 4);
        if (y + rowH > doc.page.height - 24) {
          doc.addPage({ size: "A4", layout: "landscape", margin: 28 });
          y = 28;
          drawHeader();
        }
        let x = startX;
        cols.forEach((c, i) => {
          doc.rect(x, y, c.w, rowH).stroke("#9ca3af");
          if (i === wrapIndex) {
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
              align: i === 0 || i === 7 || i === 9 || i === 12 ? "center" : "left",
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

  if ((selectedFormat === "xlsx" || selectedFormat === "xls") && selectedSource === "reports") {
    const templatePath = loadReportTemplatePath();
    if (!templatePath) {
      return res.status(500).json({ message: "Template laporan selesai tidak ditemukan." });
    }
    try {
      const wbTpl = XLSX.readFile(templatePath, { cellStyles: true });
      const ws = wbTpl.Sheets[wbTpl.SheetNames[0]];
      const decode = XLSX.utils.decode_range(ws["!ref"] || "A1:M15");
      for (let r = 5; r <= decode.e.r + 1; r += 1) {
        for (let c = 1; c <= 13; c += 1) {
          const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
          if (ws[addr]) delete ws[addr].v;
          if (ws[addr]) delete ws[addr].w;
          if (ws[addr]) ws[addr].t = "s";
        }
      }

      const fromText = from || "-";
      const toText = to || "-";
      ws.K2 = { t: "s", v: `Periode: ${fromText} s/d ${toText}` };

      const parseSummaryBlock = (summary) => {
        const text = String(summary || "");
        const lines = text.split("\n").map((s) => s.trim()).filter(Boolean);
        const take = (label) => {
          const found = lines.find((s) => s.toLowerCase().startsWith(`${label.toLowerCase()}:`));
          return found ? found.split(":").slice(1).join(":").trim() || "-" : "-";
        };
        const unitLines = lines.filter((s) => /^\d+\.\s+Kode Unit:/i.test(s));
        const units = unitLines.map((line) => {
          const parts = line.split("|").map((p) => p.trim());
          const first = parts.shift() || "";
          const unit_code = first.replace(/^\d+\.\s+Kode Unit:\s*/i, "").trim() || "-";
          const get = (label) => parts.find((p) => p.toLowerCase().startsWith(label.toLowerCase()))?.split(":").slice(1).join(":").trim() || "-";
          return {
            unit_code,
            hour_meter: get("Hour Meter"),
            merk: get("Merk"),
            tipe: get("Tipe"),
            trouble: get("Trouble"),
            action: get("Action"),
            sparepart: get("Sparepart"),
            hasil: get("Hasil"),
          };
        });
        const ringkasan = text.includes("Nama Mekanik:") ? text.slice(0, text.indexOf("Nama Mekanik:")).trim() : text.trim();
        return {
          nama_mekanik: take("Nama Mekanik"),
          customer_pt: take("Customer / PT"),
          ringkasan: ringkasan || "-",
          units,
        };
      };

      const expandedRows = [];
      rowsView.forEach((row) => {
        const parsed = parseSummaryBlock(row.summary_text);
        const units = parsed.units.length ? parsed.units : [{
          unit_code: "-", hour_meter: "-", merk: "-", tipe: "-", trouble: "-", action: "-", sparepart: "-", hasil: String(row.status || "-"),
        }];
        units.forEach((u) => {
          expandedRows.push({
            ...row,
            parsed,
            unit: u,
            export_customer: parsed.customer_pt !== "-" ? parsed.customer_pt : (row.customer || "-"),
            export_mekanik: parsed.nama_mekanik !== "-" ? parsed.nama_mekanik : (row.mekanik || "-"),
          });
        });
      });

      const byCustomer = new Map();
      expandedRows.forEach((row) => {
        const key = row.export_customer || "-";
        if (!byCustomer.has(key)) byCustomer.set(key, []);
        byCustomer.get(key).push(row);
      });
      const totalTask = new Set(rowsView.map((r) => r.code)).size;
      ws.A3 = { t: "s", v: `Total Task:  ${totalTask}` };
      ws.C3 = { t: "s", v: `Total Unit:  ${expandedRows.length}` };
      ws.E3 = { t: "s", v: `Total PT:  ${byCustomer.size}` };
      const closed = expandedRows.filter((r) => String(r.unit.hasil || "").toUpperCase().includes("CLOSED")).length;
      ws.G3 = { t: "s", v: `Closed:  ${closed}` };
      ws.I3 = { t: "s", v: `Waiting / Progress:  ${Math.max(0, expandedRows.length - closed)}` };

      let rowCursor = 5;
      let no = 1;
      for (const [customer, list] of byCustomer.entries()) {
        ws[`A${rowCursor}`] = { t: "s", v: `  ${customer}   ·   ${new Set(list.map((x) => x.code)).size} task   ·   ${list.length} unit` };
        rowCursor += 1;
        list.forEach((r) => {
          ws[`A${rowCursor}`] = { t: "n", v: no++ };
          ws[`B${rowCursor}`] = { t: "s", v: r.code || "-" };
          ws[`C${rowCursor}`] = { t: "s", v: r.tgl || "-" };
          ws[`D${rowCursor}`] = { t: "s", v: customer };
          ws[`E${rowCursor}`] = { t: "s", v: r.export_mekanik || "-" };
          ws[`F${rowCursor}`] = { t: "s", v: r.unit.unit_code || "-" };
          ws[`G${rowCursor}`] = { t: "s", v: r.unit.hour_meter || "-" };
          ws[`H${rowCursor}`] = { t: "s", v: r.unit.merk || "-" };
          ws[`I${rowCursor}`] = { t: "s", v: r.unit.tipe || "-" };
          ws[`J${rowCursor}`] = { t: "s", v: r.unit.trouble || "-" };
          ws[`K${rowCursor}`] = { t: "s", v: r.unit.action || "-" };
          ws[`L${rowCursor}`] = { t: "s", v: r.unit.sparepart || "-" };
          ws[`M${rowCursor}`] = { t: "s", v: r.unit.hasil || "-" };
          rowCursor += 1;
        });
      }

      const footerRow = rowCursor + 1;
      ws[`A${footerRow}`] = { t: "s", v: "Keterangan:" };
      ws[`D${footerRow}`] = { t: "s", v: "Closed" };
      ws[`F${footerRow}`] = { t: "s", v: "Waiting sparepart" };
      ws[`H${footerRow}`] = { t: "s", v: "On progress" };
      ws["!ref"] = `A1:M${footerRow}`;

      const out = XLSX.write(wbTpl, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=\"${filenameBase}.xlsx\"`);
      res.end(out);
      return;
    } catch {
      return res.status(500).json({ message: "Gagal memproses template laporan selesai." });
    }
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Job Activity");
  const logoBuffer = loadLogoBuffer();
  if (logoBuffer) {
    try {
      const logoId = wb.addImage({ buffer: logoBuffer, extension: "jpeg" });
      ws.addImage(logoId, {
        tl: { col: 2.7, row: 6.1 },
        ext: { width: 220, height: 52 },
      });
    } catch {
      // ignore logo failure, keep export running
    }
  }
  ws.mergeCells("B7:C7");
  ws.getCell("B7").value = "UNIT";
  ws.getCell("B7").font = { bold: true, size: 11 };
  ws.getCell("B7").alignment = { horizontal: "center", vertical: "middle" };
  ws.mergeCells("A10:N10");
  ws.getCell("A10").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7D9DD" } };
  ws.getCell("A10").value = "PCS";
  ws.getCell("A10").font = { bold: true, size: 11 };
  ws.getCell("A10").alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(7).height = 24;
  ws.getRow(10).height = 20;

  const headerRow = 11;
  const headers = ["No", "Tgl", "Job", "Detail Job", "Customer", "Lokasi", "Plan", "Aging", "Status", "Staff", "Mekanik", "Final", "Keterangan", "Dokumentasi"];
  ws.getRow(headerRow).values = [, ...headers];
  ws.getRow(headerRow).font = { bold: true };
  ws.getRow(headerRow).alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(headerRow).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEDED" } };
  ws.getRow(headerRow).height = 24;
  ws.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow, column: headers.length },
  };
  ws.views = [{ state: "frozen", ySplit: headerRow }];

  const widths = [5, 12, 10, 24, 16, 12, 12, 7, 12, 14, 13, 8, 14, 16];
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
      r.dokumentasi,
    ];
    ws.getRow(rowIdx).height = 22;
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
      if (r > headerRow && (c === 4 || c === 13 || c === 14)) {
        cell.alignment = { ...cell.alignment, wrapText: true };
      }
    }
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=\"${filenameBase}.xlsx\"`);
  await wb.xlsx.write(res);
  res.end();
}

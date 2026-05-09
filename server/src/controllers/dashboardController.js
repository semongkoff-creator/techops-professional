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

export async function exportDummy(req, res) {
  const { from, to, technician_id, format } = req.query;
  const selectedFormat = String(format || "pdf").toLowerCase();
  if (!["pdf", "xls", "xlsx"].includes(selectedFormat)) {
    return res.status(400).json({ message: "Invalid format. Use pdf or xls" });
  }

  let sql = `SELECT r.id, r.report_date, r.progress_percent, r.issue_text, r.summary_text, r.report_status,
                    t.code AS task_code, t.title AS task_title, t.location,
                    u.name AS technician_name
             FROM daily_reports r
             JOIN tasks t ON t.id = r.task_id
             JOIN users u ON u.id = r.technician_id
             WHERE 1=1`;
  const params = [];

  if (from) {
    sql += " AND r.report_date >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND r.report_date <= ?";
    params.push(to);
  }
  if (technician_id) {
    sql += " AND r.technician_id = ?";
    params.push(Number(technician_id));
  }
  if (req.user.role === "atasan") {
    sql += " AND t.created_by_atasan_id = ?";
    params.push(req.user.id);
  } else if (req.user.role === "supervisor") {
    sql += " AND r.supervisor_id = ?";
    params.push(req.user.id);
  } else {
    sql += " AND r.technician_id = ?";
    params.push(req.user.id);
  }
  sql += " ORDER BY r.report_date DESC, r.id DESC";

  const [rows] = await pool.execute(sql, params);
  const filenameBase = `techops-report-${from || "all"}-${to || "all"}`;

  if (selectedFormat === "pdf") {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=\"${filenameBase}.pdf\"`);

    const doc = new PDFDocument({ margin: 36, size: "A4" });
    doc.pipe(res);
    doc.fontSize(16).text("TechOps Professional - Report Export");
    doc.moveDown(0.3);
    doc.fontSize(10).text(`Filter: from=${from || "-"} to=${to || "-"} technician_id=${technician_id || "-"}`);
    doc.moveDown(0.8);

    rows.forEach((r, idx) => {
      doc.fontSize(11).text(`${idx + 1}. ${r.task_code} - ${r.task_title}`);
      doc.fontSize(10).text(`Tanggal: ${new Date(r.report_date).toISOString().slice(0, 10)} | Teknisi: ${r.technician_name}`);
      doc.text(`Lokasi: ${r.location} | Progress: ${r.progress_percent}% | Status: ${r.report_status}`);
      doc.text(`Kendala: ${r.issue_text || "-"}`);
      doc.text(`Ringkasan: ${r.summary_text}`);
      doc.moveDown(0.8);
    });
    doc.end();
    return;
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Daily Reports");
  ws.columns = [
    { header: "ID", key: "id", width: 8 },
    { header: "Tanggal", key: "report_date", width: 14 },
    { header: "Task Code", key: "task_code", width: 18 },
    { header: "Task Title", key: "task_title", width: 28 },
    { header: "Lokasi", key: "location", width: 22 },
    { header: "Teknisi", key: "technician_name", width: 20 },
    { header: "Progress %", key: "progress_percent", width: 12 },
    { header: "Status", key: "report_status", width: 24 },
    { header: "Kendala", key: "issue_text", width: 28 },
    { header: "Ringkasan", key: "summary_text", width: 40 },
  ];
  ws.getRow(1).font = { bold: true };
  rows.forEach((r) => ws.addRow({
    ...r,
    report_date: new Date(r.report_date).toISOString().slice(0, 10),
    issue_text: r.issue_text || "-",
  }));

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=\"${filenameBase}.xlsx\"`);
  await wb.xlsx.write(res);
  res.end();
}

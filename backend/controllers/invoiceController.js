import { InvoiceModel } from "../models/invoiceModel.js";
import generateInvoicePDF from "../utils/generateInvoicePDF.js";

export const printInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const register_id = req.user.register_id;

    console.log("REGISTER ID:", register_id);

    // 🔑 Resolve tenant DB
    const tenantDB = await InvoiceModel.getTenantDB(register_id);
    if (!tenantDB) {
      return res.status(404).json({ message: "Tenant DB not found" });
    }

    // 📦 Fetch invoice data
    const invoiceData = await InvoiceModel.getInvoiceData(
      tenantDB,
      orderId
    );

    if (!invoiceData) {
      return res.status(404).json({ message: "Order not found" });
    }

    // 🧾 Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoiceData);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=invoice-${orderId}.pdf`
    );

    res.send(pdfBuffer);

  } catch (err) {
    console.error("Invoice print error:", err);
    res.status(500).json({ message: "Failed to generate invoice" });
  }
};

import PDFDocument from "pdfkit";
import QRCode from "qrcode";

const generateInvoicePDF = async (data) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40 });
      const buffers = [];

      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      /* ================= HEADER ================= */
      doc
        .fontSize(20)
        .text("INVOICE", { align: "center" })
        .moveDown(1);

      doc.fontSize(10);
      doc.text(`Order No: ${data.order.order_no}`);
      doc.text(
        `Order Date: ${new Date(
          data.order.created_at
        ).toLocaleString()}`
      );
      doc.moveDown(1);

      /* ================= CUSTOMER ================= */
      doc.fontSize(12).text("Customer Details", {
        underline: true,
      });
      doc.moveDown(0.5);

      doc.fontSize(10);
      doc.text(`Name: ${data.order.customer_name}`);
      doc.text(`Phone: ${data.order.phone}`);

      const isDelivery =
        data.order.full_address &&
        data.order.full_address !== "N/A";

      if (isDelivery) {
        doc.text("Delivery Address:");
        doc.text(data.order.full_address, {
          width: 350,
        });
      } else {
        doc.text("Pickup Order");
      }

      doc.moveDown(1);

      /* ================= ITEMS ================= */
      doc.fontSize(12).text("Order Items", {
        underline: true,
      });
      doc.moveDown(0.5);

      doc.fontSize(10);
      data.items.forEach((item, index) => {
        doc.text(
          `${index + 1}. ${item.product_name}  x${
            item.product_qty
          }  ₹${item.product_amount}`
        );
      });

      doc.moveDown(1);

      doc
        .fontSize(12)
        .text(
          `Total Amount: ₹${data.order.total_amount}`,
          { align: "right" }
        );

      /* ================= QR CODE ================= */
      doc.moveDown(2);
      doc.fontSize(12).text(
        "Scan for Order Actions",
        { underline: true }
      );
      doc.moveDown(0.5);

      // Encode address for Google Maps
      const encodedAddress = encodeURIComponent(
        data.order.full_address || ""
      );

      // 🔐 QR CONTENT (TEXT + ACTION LINKS)
      let qrText = "";

      if (isDelivery) {
        qrText = `
Order No: ${data.order.order_no}
Customer: ${data.order.customer_name}
Phone: ${data.order.phone}

📞 Call Customer:
tel:${data.order.phone}

📍 Open Location:
https://www.google.com/maps/search/?api=1&query=${encodedAddress}
`;
      } else {
        qrText = `
Order No: ${data.order.order_no}
Customer: ${data.order.customer_name}

🏪 Pickup Order

🔎 Track Order:
https://192.168.0.210/order/${data.order.order_no}
`;
      }

      const qrImage = await QRCode.toDataURL(qrText);

      doc.image(qrImage, {
        fit: [120, 120],
        align: "left",
      });

      /* ================= FOOTER ================= */
      doc.moveDown(1.5);
      doc
        .fontSize(9)
        .fillColor("gray")
        .text(
          "Thank you for your order!",
          { align: "center" }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

export default generateInvoicePDF;

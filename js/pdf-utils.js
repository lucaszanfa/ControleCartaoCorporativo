function pdfSanitizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pdfEscape(value) {
  return pdfSanitizeText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function pdfDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

class PdfReport {
  constructor({ title, subtitle = "", orientation = "landscape" }) {
    this.width = orientation === "landscape" ? 842 : 595;
    this.height = orientation === "landscape" ? 595 : 842;
    this.margin = 34;
    this.title = title;
    this.subtitle = subtitle;
    this.pages = [];
    this.addPage();
  }

  addPage() {
    this.current = [];
    this.pages.push(this.current);
    this.y = this.margin;
    this.header();
  }

  header() {
    this.rect(0, 0, this.width, 68, [15, 23, 42]);
    this.rect(0, 68, this.width, 4, [20, 184, 166]);
    this.text(this.title, this.margin, 30, { size: 18, bold: true, color: [255, 255, 255] });
    if (this.subtitle) {
      this.text(this.subtitle, this.margin, 52, { size: 9, color: [203, 213, 225] });
    }
    this.y = 94;
  }

  ensureSpace(height) {
    if (this.y + height > this.height - this.margin) this.addPage();
  }

  color([r, g, b]) {
    return `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)}`;
  }

  rect(x, y, w, h, color) {
    const pdfY = this.height - y - h;
    this.current.push(`${this.color(color)} rg ${x.toFixed(2)} ${pdfY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }

  line(x1, y1, x2, y2, color = [217, 222, 231]) {
    this.current.push(`${this.color(color)} RG 0.7 w ${x1.toFixed(2)} ${(this.height - y1).toFixed(2)} m ${x2.toFixed(2)} ${(this.height - y2).toFixed(2)} l S`);
  }

  text(value, x, y, options = {}) {
    const size = options.size || 9;
    const font = options.bold ? "F2" : "F1";
    const color = options.color || [17, 24, 39];
    const pdfY = this.height - y - size;
    this.current.push(`BT /${font} ${size} Tf ${this.color(color)} rg ${x.toFixed(2)} ${pdfY.toFixed(2)} Td (${pdfEscape(value)}) Tj ET`);
  }

  wrapText(value, maxWidth, size = 9) {
    const words = pdfSanitizeText(value).split(" ");
    const lines = [];
    let line = "";
    const maxChars = Math.max(8, Math.floor(maxWidth / (size * 0.52)));

    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (next.length > maxChars) {
        if (line) lines.push(line);
        line = word;
      } else {
        line = next;
      }
    });
    if (line) lines.push(line);
    return lines.length ? lines : ["-"];
  }

  section(title) {
    this.ensureSpace(30);
    this.text(title, this.margin, this.y, { size: 13, bold: true, color: [15, 23, 42] });
    this.line(this.margin, this.y + 18, this.width - this.margin, this.y + 18, [226, 232, 240]);
    this.y += 22;
  }

  keyValues(items) {
    this.ensureSpace(Math.ceil(items.length / 3) * 28 + 10);
    const colW = (this.width - this.margin * 2 - 16) / 3;
    items.forEach((item, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = this.margin + col * (colW + 8);
      const y = this.y + row * 28;
      this.rect(x, y, colW, 22, [248, 250, 252]);
      this.text(item.label, x + 7, y + 6, { size: 7, bold: true, color: [71, 85, 105] });
      this.text(item.value, x + 7, y + 16, { size: 8, color: [17, 24, 39] });
    });
    this.y += Math.ceil(items.length / 3) * 28 + 8;
  }

  table(headers, rows, widths) {
    const x0 = this.margin;
    const tableWidth = widths.reduce((sum, width) => sum + width, 0);
    const drawHeader = () => {
      this.ensureSpace(32);
      this.rect(x0, this.y, tableWidth, 24, [30, 41, 59]);
      let x = x0;
      headers.forEach((header, index) => {
        this.text(header, x + 6, this.y + 9, { size: 8, bold: true, color: [255, 255, 255] });
        x += widths[index];
      });
      this.y += 24;
    };

    drawHeader();
    rows.forEach((row, rowIndex) => {
      const lineSets = row.map((cell, index) => this.wrapText(cell, widths[index] - 12, 8));
      const rowHeight = Math.max(24, Math.max(...lineSets.map((lines) => lines.length)) * 10 + 12);
      if (this.y + rowHeight > this.height - this.margin) {
        this.addPage();
        drawHeader();
      }
      this.rect(x0, this.y, tableWidth, rowHeight, rowIndex % 2 ? [248, 250, 252] : [255, 255, 255]);
      let x = x0;
      lineSets.forEach((lines, index) => {
        lines.slice(0, 3).forEach((line, lineIndex) => {
          this.text(line, x + 6, this.y + 9 + lineIndex * 10, { size: 8 });
        });
        x += widths[index];
      });
      this.line(x0, this.y + rowHeight, x0 + tableWidth, this.y + rowHeight);
      this.y += rowHeight;
    });
    this.y += 16;
  }

  output(fileName) {
    const objects = [];
    const addObject = (content) => {
      objects.push(content);
      return objects.length;
    };

    const font1 = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    const font2 = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    const pageIds = [];

    this.pages.forEach((commands) => {
      const stream = commands.join("\n");
      const contentId = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      const pageId = addObject(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${this.width} ${this.height}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${contentId} 0 R >>`);
      pageIds.push(pageId);
    });

    const pagesId = addObject(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
    pageIds.forEach((id) => {
      objects[id - 1] = objects[id - 1].replace("/Parent 0 0 R", `/Parent ${pagesId} 0 R`);
    });
    const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;

    pdfDownload(new Blob([pdf], { type: "application/pdf" }), fileName);
  }
}

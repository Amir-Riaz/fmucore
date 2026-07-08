export function generateCertificate({ name, title, track, serial }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1130;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#F6FAF7";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#00354F";
  ctx.lineWidth = 10;
  ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);
  ctx.strokeStyle = "#CEFF99";
  ctx.lineWidth = 3;
  ctx.strokeRect(50, 50, canvas.width - 100, canvas.height - 100);

  ctx.textAlign = "center";
  ctx.fillStyle = "#00354F";
  ctx.font = "700 32px Poppins, sans-serif";
  ctx.fillText("FMU CORE 2026", canvas.width / 2, 140);
  ctx.font = "400 20px Poppins, sans-serif";
  ctx.fillStyle = "#2F7E8F";
  ctx.fillText("Conference on Research Excellence", canvas.width / 2, 175);

  ctx.font = "700 52px Anton, sans-serif";
  ctx.fillStyle = "#0F3A47";
  ctx.fillText("CERTIFICATE OF PRESENTATION", canvas.width / 2, 300);

  ctx.font = "400 22px Poppins, sans-serif";
  ctx.fillStyle = "#444";
  ctx.fillText("This certificate is proudly presented to", canvas.width / 2, 400);

  ctx.font = "700 48px Poppins, sans-serif";
  ctx.fillStyle = "#00354F";
  ctx.fillText(name || "Participant", canvas.width / 2, 470);

  ctx.font = "400 20px Poppins, sans-serif";
  ctx.fillStyle = "#444";
  wrapText(ctx, `for presenting the abstract "${title || "—"}"`, canvas.width / 2, 540, 1200, 28);

  ctx.font = "600 20px Poppins, sans-serif";
  ctx.fillStyle = "#185262";
  ctx.fillText(`Presentation Track: ${track || "—"}`, canvas.width / 2, 620);

  ctx.font = "400 16px Poppins, sans-serif";
  ctx.fillStyle = "#888";
  ctx.fillText(`Serial: ${serial || "—"}`, canvas.width / 2, 660);

  ctx.strokeStyle = "#999";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(250, 950); ctx.lineTo(650, 950); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(950, 950); ctx.lineTo(1350, 950); ctx.stroke();
  ctx.font = "400 16px Poppins, sans-serif";
  ctx.fillStyle = "#555";
  ctx.fillText("Organizing Committee", 450, 980);
  ctx.fillText("Conference Chair", 1150, 980);

  return canvas;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let curY = y;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    if (ctx.measureText(testLine).width > maxWidth && n > 0) {
      ctx.fillText(line, x, curY);
      line = words[n] + " ";
      curY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, curY);
}

export function showCertificateInNewTab(canvas, filename = "certificate.png") {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const tab = window.open();
    if (tab) {
      tab.document.write(`<html><head><title>${filename}</title></head>
        <body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;">
        <img src="${url}" style="max-width:100%;height:auto;" /></body></html>`);
      tab.document.close();
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
    }
  }, "image/png");
}
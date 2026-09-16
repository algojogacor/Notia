import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { NoteWithSubject, Subject } from '../types';
import { SUBJECT_PALETTE } from '../db/database';

const PAPER_COLOR = '#FDFCF8';
const INK_COLOR = '#2A2925';
const FAINT_COLOR = '#9B9990';
const RULE_COLOR = '#E4E2D8';
const PUNCH_HOLE = '#EBE9DF';
const HOLE_SHADOW = 'rgba(0,0,0,0.1)';

const CSS_STYLES = `
  @page { margin: 0; size: A4 portrait; }
  body {
    margin: 0;
    padding: 0;
    background-color: ${PAPER_COLOR};
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: ${INK_COLOR};
    -webkit-print-color-adjust: exact;
  }
  .page {
    position: relative;
    width: 210mm;
    height: 296mm;
    page-break-after: always;
    box-sizing: border-box;
    padding: 24mm 20mm 24mm 32mm;
    overflow: hidden;
  }
  .ruled-bg {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background-image: repeating-linear-gradient(to bottom, transparent, transparent 31px, ${RULE_COLOR} 31px, ${RULE_COLOR} 32px);
    background-position: 0 40px;
    z-index: 1;
  }
  .spine {
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 14mm;
    border-right: 1px solid ${RULE_COLOR};
    background: linear-gradient(to right, rgba(0,0,0,0.03), transparent);
    z-index: 2;
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
    align-items: center;
  }
  .hole {
    width: 6mm; height: 6mm;
    border-radius: 50%;
    background-color: #fff;
    box-shadow: inset 1px 1px 2px ${HOLE_SHADOW};
  }
  .content {
    position: relative;
    z-index: 5;
    line-height: 32px;
  }
  h1.serif-title {
    font-family: 'Times New Roman', Times, serif;
    font-size: 24px;
    margin: 0 0 16px 0;
    line-height: 1.2;
  }
  .eyebrow {
    font-size: 11px;
    font-weight: bold;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 24px;
  }
  .meta {
    font-size: 13px;
    color: ${FAINT_COLOR};
    margin-bottom: 24px;
  }
  .summary {
    font-family: 'Times New Roman', Times, serif;
    font-style: italic;
    font-size: 15px;
    color: #555;
    border-top: 1px solid ${RULE_COLOR};
    padding-top: 16px;
    margin-bottom: 32px;
    line-height: 1.6;
  }
  .transcription {
    font-size: 14.5px;
    line-height: 32px;
  }
  .taped-photo {
    max-width: 80%;
    max-height: 350px;
    border: 1px solid ${RULE_COLOR};
    margin-bottom: 32px;
    display: block;
  }
  .footer {
    position: absolute;
    bottom: 12mm;
    left: 0; right: 0;
    text-align: center;
    font-size: 11px;
    color: ${FAINT_COLOR};
    z-index: 5;
  }
  .index-tab {
    position: absolute;
    top: 0; left: 40mm;
    padding: 6px 16px;
    border-bottom-left-radius: 4px;
    border-bottom-right-radius: 4px;
    color: white;
    font-size: 11px;
    font-weight: bold;
    z-index: 5;
  }
  .cover-page {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
  }
  .cover-title {
    font-family: 'Times New Roman', Times, serif;
    font-size: 36px;
    margin-bottom: 16px;
  }
  .cover-subtitle {
    font-size: 14px;
    color: ${FAINT_COLOR};
    text-transform: uppercase;
    letter-spacing: 2px;
  }
`;

const generatePageStructure = (content: string, pageNum: number, color?: string, tabText?: string) => `
  <div class="page">
    <div class="ruled-bg"></div>
    <div class="spine">
      <div class="hole"></div>
      <div class="hole"></div>
      <div class="hole"></div>
      <div class="hole"></div>
    </div>
    ${tabText && color ? `<div class="index-tab" style="background-color: ${color}">${tabText}</div>` : ''}
    <div class="content">
      ${content}
    </div>
    <div class="footer">- ${pageNum} -</div>
  </div>
`;

function escapeHtml(unsafe: string) {
  return (unsafe || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function exportNoteToPdf(note: NoteWithSubject) {
  try {
    const subjectColor = note.subject_id ? (((SUBJECT_PALETTE as any)[note.subject_id] as string) || '#000') : '#000';
    const dateStr = new Date(note.date_taken).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
    
    // We cannot easily embed local file:// images into expo-print HTML unless base64 encoded.
    let base64Image = '';
    if (note.image_path) {
      try {
        const b64 = await FileSystem.readAsStringAsync(note.image_path, { encoding: FileSystem.EncodingType.Base64 });
        const ext = note.image_path.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
        base64Image = `<img src="data:image/${ext};base64,${b64}" class="taped-photo" />`;
      } catch (e) {
        console.warn('Could not read image for PDF');
      }
    }

    const contentHtml = `
      <div class="eyebrow" style="color: ${subjectColor}">${escapeHtml(note.subject_name || 'TANPA MATA KULIAH')}</div>
      <h1 class="serif-title">${escapeHtml(note.title || 'Catatan')}</h1>
      <div class="meta">${dateStr}</div>
      ${note.summary ? `<div class="summary">${escapeHtml(note.summary)}</div>` : ''}
      ${base64Image}
      <div class="transcription">
        ${escapeHtml(note.extracted_text || 'Belum ada transkripsi teks.').replace(/\\n/g, '<br/>')}
      </div>
    `;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>${CSS_STYLES}</style>
        </head>
        <body>
          ${generatePageStructure(contentHtml, 1, subjectColor, escapeHtml(note.subject_name || 'NOTIA'))}
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { dialogTitle: 'Ekspor Catatan (PDF)' });
    }
  } catch (err) {
    console.error('PDF Export Error:', err);
  }
}

export async function exportSubjectBookletToPdf(subject: Subject, notes: NoteWithSubject[]) {
  try {
    const subjectColor = subject.color || '#000';
    let pagesHtml = '';
    
    // Cover Page
    pagesHtml += `
      <div class="page cover-page" style="background-color: ${subjectColor}11;">
        <div class="spine">
          <div class="hole"></div><div class="hole"></div><div class="hole"></div><div class="hole"></div>
        </div>
        <div class="content" style="text-align: center; margin-top: 40%;">
          <div class="cover-subtitle">SEKSI BINDER NOTIA</div>
          <h1 class="cover-title" style="color: ${subjectColor};">${escapeHtml(subject.name)}</h1>
          <div class="meta">${notes.length} Lembar Catatan</div>
        </div>
      </div>
    `;

    // Note Pages
    let pageNum = 1;
    for (const note of notes) {
      let base64Image = '';
      if (note.image_path) {
        try {
          const b64 = await FileSystem.readAsStringAsync(note.image_path, { encoding: FileSystem.EncodingType.Base64 });
          const ext = note.image_path.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
          base64Image = `<img src="data:image/${ext};base64,${b64}" class="taped-photo" />`;
        } catch (e) {}
      }

      const dateStr = new Date(note.date_taken).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
      const contentHtml = `
        <div class="eyebrow" style="color: ${subjectColor}">${escapeHtml(subject.name)}</div>
        <h1 class="serif-title">${escapeHtml(note.title || 'Catatan')}</h1>
        <div class="meta">${dateStr}</div>
        ${note.summary ? `<div class="summary">${escapeHtml(note.summary)}</div>` : ''}
        ${base64Image}
        <div class="transcription">
          ${escapeHtml(note.extracted_text || 'Belum ada transkripsi teks.').replace(/\\n/g, '<br/>')}
        </div>
      `;
      
      pagesHtml += generatePageStructure(contentHtml, pageNum, subjectColor, subject.name);
      pageNum++;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>${CSS_STYLES}</style>
        </head>
        <body>
          ${pagesHtml}
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { dialogTitle: `Ekspor Booklet - ${subject.name}` });
    }
  } catch (err) {
    console.error('Booklet Export Error:', err);
  }
}

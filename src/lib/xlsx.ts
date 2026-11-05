import { strToU8, zipSync } from 'fflate';

/**
 * Minimalny generator plików .xlsx (Office Open XML) bez zewnętrznych bibliotek.
 * Obsługuje: wiele arkuszy, wspólne teksty, style (nagłówki, kolory nasilenia),
 * daty, szerokości kolumn, zamrożone wiersze i kolumny oraz autofiltr.
 */

export type StyleKey =
  | 'default'
  | 'header'
  | 'headerPmdd'
  | 'headerPms'
  | 'date'
  | 'decimal'
  | 'wrap'
  | 'sev1'
  | 'sev2'
  | 'sev3'
  | 'sev4'
  | 'sev5'
  | 'sev6'
  | 'title'
  | 'muted'
  | 'bold'
  | 'center';

const STYLE_INDEX: Record<StyleKey, number> = {
  default: 0,
  header: 1,
  headerPmdd: 2,
  headerPms: 3,
  date: 4,
  decimal: 5,
  wrap: 6,
  sev1: 7,
  sev2: 8,
  sev3: 9,
  sev4: 10,
  sev5: 11,
  sev6: 12,
  title: 13,
  muted: 14,
  bold: 15,
  center: 16,
};

export interface Cell {
  /** liczba, tekst lub data (jako numer seryjny Excela) */
  v: string | number | null | undefined;
  s?: StyleKey;
}

export interface Sheet {
  name: string;
  /** szerokości kolumn w znakach */
  widths?: number[];
  rows: (Cell | string | number | null | undefined)[][];
  freeze?: { rows: number; cols: number };
  autoFilter?: boolean;
  /** wysokość pierwszego wiersza (np. dla zawijanych nagłówków) */
  headerHeight?: number;
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/**
 * Usuwa znaki niedozwolone w XML 1.0 (poza tab, LF, CR) oraz samotne surogaty.
 * Bez regexów z lookbehind, bo starsze iOS (przed 16.4) ich nie obsługują.
 */
function stripInvalidXml(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += s[i] + s[i + 1];
        i++;
      }
      continue;
    }
    if (c >= 0xdc00 && c <= 0xdfff) continue;
    if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) continue;
    if (c === 0xfffe || c === 0xffff) continue;
    out += s[i];
  }
  return out;
}

export function escapeXml(s: string): string {
  return stripInvalidXml(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function columnName(index0: number): string {
  let n = index0 + 1;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Nazwy arkuszy: max 31 znaków, bez znaków : \ / ? * [ ] */
export function safeSheetName(name: string): string {
  const cleaned = name
    .replace(/[:\\/?*[\]]/g, ' ')
    .trim()
    .slice(0, 31);
  return cleaned || 'Arkusz';
}

function normalizeCell(c: Cell | string | number | null | undefined): Cell {
  if (c === null || c === undefined) return { v: null };
  if (typeof c === 'string' || typeof c === 'number') return { v: c };
  return c;
}

const STYLES_XML = `${XML_HEADER}<styleSheet xmlns="${NS_MAIN}">
<numFmts count="2"><numFmt numFmtId="164" formatCode="dd.mm.yyyy"/><numFmt numFmtId="165" formatCode="0.0"/></numFmts>
<fonts count="6">
<font><sz val="11"/><color rgb="FF263228"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FF263228"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
<font><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="14"/><color rgb="FF263228"/><name val="Calibri"/><family val="2"/></font>
<font><sz val="10"/><color rgb="FF5F6858"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="11">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF465C3F"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFCBD7BF"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEFE7D9"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF0F3EA"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFDCE5D2"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFBCCBAF"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF8FA682"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF5B7351"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF6F2B3E"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top/><bottom style="thin"><color rgb="FFC9C0AF"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="17">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="5" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="6" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="7" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="8" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="9" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="10" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

export function buildXlsx(sheets: Sheet[], meta: { title?: string; createdAt?: Date } = {}): Uint8Array {
  const strings: string[] = [];
  const stringIndex = new Map<string, number>();
  const sst = (s: string) => {
    let i = stringIndex.get(s);
    if (i === undefined) {
      i = strings.length;
      strings.push(s);
      stringIndex.set(s, i);
    }
    return i;
  };

  const usedNames = new Set<string>();
  const names = sheets.map((sh) => {
    let base = safeSheetName(sh.name);
    let name = base;
    let k = 2;
    while (usedNames.has(name.toLowerCase())) name = `${base.slice(0, 28)} ${k++}`;
    usedNames.add(name.toLowerCase());
    return name;
  });

  const sheetXml = sheets.map((sh, si) => {
    const rows = sh.rows.map((r) => r.map(normalizeCell));
    const maxCols = Math.max(1, ...rows.map((r) => r.length));
    const lastRef = `${columnName(maxCols - 1)}${Math.max(1, rows.length)}`;

    let views = `<sheetViews><sheetView workbookViewId="0"${si === 0 ? ' tabSelected="1"' : ''}>`;
    if (sh.freeze && (sh.freeze.rows > 0 || sh.freeze.cols > 0)) {
      const { rows: fr, cols: fc } = sh.freeze;
      const topLeft = `${columnName(fc)}${fr + 1}`;
      const pane = fr > 0 && fc > 0 ? 'bottomRight' : fr > 0 ? 'bottomLeft' : 'topRight';
      views += `<pane${fc > 0 ? ` xSplit="${fc}"` : ''}${fr > 0 ? ` ySplit="${fr}"` : ''} topLeftCell="${topLeft}" activePane="${pane}" state="frozen"/>`;
      views += `<selection pane="${pane}" activeCell="${topLeft}" sqref="${topLeft}"/>`;
    }
    views += '</sheetView></sheetViews>';

    const cols = sh.widths?.length
      ? `<cols>${sh.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
      : '';

    const body = rows
      .map((r, ri) => {
        const rn = ri + 1;
        const ht = ri === 0 && sh.headerHeight ? ` ht="${sh.headerHeight}" customHeight="1"` : '';
        const cells = r
          .map((c, ci) => {
            const ref = `${columnName(ci)}${rn}`;
            const s = c.s ? STYLE_INDEX[c.s] : 0;
            const sAttr = s ? ` s="${s}"` : '';
            if (c.v === null || c.v === undefined || c.v === '') return s ? `<c r="${ref}"${sAttr}/>` : '';
            if (typeof c.v === 'number') {
              if (!Number.isFinite(c.v)) return '';
              return `<c r="${ref}"${sAttr}><v>${c.v}</v></c>`;
            }
            return `<c r="${ref}"${sAttr} t="s"><v>${sst(c.v)}</v></c>`;
          })
          .join('');
        return `<row r="${rn}"${ht}>${cells}</row>`;
      })
      .join('');

    const filter = sh.autoFilter && rows.length > 1 ? `<autoFilter ref="A1:${lastRef}"/>` : '';
    return `${XML_HEADER}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><dimension ref="A1:${lastRef}"/>${views}<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${body}</sheetData>${filter}<pageMargins left="0.5" right="0.5" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`;
  });

  const definedNames = sheets
    .map((sh, i) => {
      if (!sh.autoFilter || sh.rows.length < 2) return '';
      const maxCols = Math.max(1, ...sh.rows.map((r) => r.length));
      const ref = `'${names[i].replace(/'/g, "''")}'!$A$1:$${columnName(maxCols - 1)}$${sh.rows.length}`;
      return `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${escapeXml(ref)}</definedName>`;
    })
    .join('');

  const workbook = `${XML_HEADER}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${names
    .map((n, i) => `<sheet name="${escapeXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('')}</sheets>${definedNames ? `<definedNames>${definedNames}</definedNames>` : ''}</workbook>`;

  const workbookRels = `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join(
      '',
    )}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${
    sheets.length + 2
  }" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`;

  const sharedStrings = `${XML_HEADER}<sst xmlns="${NS_MAIN}" count="${strings.length}" uniqueCount="${strings.length}">${strings
    .map((s) => `<si><t xml:space="preserve">${escapeXml(s)}</t></si>`)
    .join('')}</sst>`;

  const contentTypes = `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join(
      '',
    )}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;

  const rootRels = `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;

  const created = (meta.createdAt ?? new Date()).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const core = `${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(
    meta.title ?? 'ReportPMDD',
  )}</dc:title><dc:creator>ReportPMDD</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified></cp:coreProperties>`;
  const app = `${XML_HEADER}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>ReportPMDD</Application></Properties>`;

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rootRels),
    'docProps/core.xml': strToU8(core),
    'docProps/app.xml': strToU8(app),
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(workbookRels),
    'xl/styles.xml': strToU8(STYLES_XML),
    'xl/sharedStrings.xml': strToU8(sharedStrings),
  };
  sheetXml.forEach((xml, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(xml);
  });
  return zipSync(files, { level: 6 });
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

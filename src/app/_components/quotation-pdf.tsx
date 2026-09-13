import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const aed = (v: string | number) =>
  `AED ${new Intl.NumberFormat("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(v))}`;

const fmtDate = (d: Date | string | null) =>
  d
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(d))
    : "—";

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    color: "#22322e",
    fontFamily: "Helvetica",
    lineHeight: 1.35,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  brand: { fontSize: 18, fontWeight: "bold", color: "#122f2a" },
  brandTag: { fontSize: 7.5, color: "#8a6d3b", marginTop: 2, letterSpacing: 1.5 },
  titleBox: { alignItems: "flex-end" },
  title: { fontSize: 15, fontWeight: "bold", color: "#122f2a" },
  subtitle: { fontSize: 8.5, color: "#5c6b66", marginTop: 3 },
  statusPill: { marginTop: 4, fontSize: 8, fontWeight: "bold", color: "#1f6f5c" },
  rule: { height: 2, backgroundColor: "#1f6f5c", marginBottom: 16 },
  parties: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  party: { width: "48%" },
  label: {
    fontSize: 7.5,
    color: "#8a6d3b",
    letterSpacing: 1,
    marginBottom: 3,
    fontWeight: "bold",
  },
  partyName: { fontSize: 10.5, fontWeight: "bold", color: "#122f2a" },
  partyLine: { fontSize: 8.5, color: "#5c6b66", marginTop: 2 },
  th: {
    flexDirection: "row",
    backgroundColor: "#122f2a",
    color: "#ffffff",
    fontSize: 7.5,
    fontWeight: "bold",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  td: {
    flexDirection: "row",
    fontSize: 8.5,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2dbd0",
  },
  colDesc: { width: "40%" },
  colSku: { width: "16%" },
  colQty: { width: "10%", textAlign: "right" },
  colPrice: { width: "14%", textAlign: "right" },
  colDisc: { width: "10%", textAlign: "right" },
  colTotal: { width: "10%", textAlign: "right" },
  totalsBox: { marginTop: 10, marginLeft: "55%", width: "45%" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8.5,
    paddingVertical: 3,
    color: "#5c6b66",
  },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 11,
    fontWeight: "bold",
    color: "#122f2a",
    borderTopWidth: 1,
    borderTopColor: "#122f2a",
    marginTop: 4,
    paddingTop: 5,
  },
  notesBox: { marginTop: 16 },
  notes: { fontSize: 8.5, color: "#5c6b66" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#9aa5a1",
  },
});

type PdfLineItem = {
  description: string;
  sku: string | null;
  quantity: string;
  unitPrice: string;
  discount: string;
  lineTotal: string;
};

type PdfQuote = {
  quoteNumber: string;
  status: string;
  validUntil: string | null;
  createdAt: Date;
  companyName: string | null;
  dealName: string | null;
  customerNotes: string | null;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
};

export function QuotationPdfDocument(props: {
  quote: PdfQuote;
  lineItems: PdfLineItem[];
}) {
  const { quote, lineItems } = props;

  return (
    <Document title={`${quote.quoteNumber}.pdf`} author="Dealflow CRM">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Dealflow</Text>
            <Text style={styles.brandTag}>REVENUE WORKSPACE · DEMO</Text>
          </View>
          <View style={styles.titleBox}>
            <Text style={styles.title}>QUOTATION</Text>
            <Text style={styles.subtitle}>{quote.quoteNumber}</Text>
            <Text style={styles.subtitle}>
              Issued: {fmtDate(quote.createdAt)}
            </Text>
            <Text style={styles.subtitle}>
              Valid until: {fmtDate(quote.validUntil)}
            </Text>
            <Text style={styles.statusPill}>
              Status: {quote.status.replace(/_/g, " ").toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.rule} />

        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.label}>PREPARED FOR</Text>
            <Text style={styles.partyName}>{quote.companyName ?? "—"}</Text>
            {quote.dealName && (
              <Text style={styles.partyLine}>Deal: {quote.dealName}</Text>
            )}
          </View>
          <View style={styles.party}>
            <Text style={styles.label}>PREPARED BY</Text>
            <Text style={styles.partyName}>Dealflow Demo LLC</Text>
            <Text style={styles.partyLine}>
              Dubai Internet City, Dubai, UAE
            </Text>
            <Text style={styles.partyLine}>TRN: 100-DEMO-000 · VAT 5%</Text>
          </View>
        </View>

        <View style={styles.th}>
          <Text style={styles.colDesc}>DESCRIPTION</Text>
          <Text style={styles.colSku}>SKU</Text>
          <Text style={styles.colQty}>QTY</Text>
          <Text style={styles.colPrice}>UNIT PRICE</Text>
          <Text style={styles.colDisc}>DISCOUNT</Text>
          <Text style={styles.colTotal}>TOTAL</Text>
        </View>
        {lineItems.map((l, i) => (
          <View style={styles.td} key={i}>
            <Text style={styles.colDesc}>{l.description}</Text>
            <Text style={styles.colSku}>{l.sku ?? "—"}</Text>
            <Text style={styles.colQty}>{Number(l.quantity)}</Text>
            <Text style={styles.colPrice}>{aed(l.unitPrice)}</Text>
            <Text style={styles.colDisc}>{aed(l.discount)}</Text>
            <Text style={styles.colTotal}>{aed(l.lineTotal)}</Text>
          </View>
        ))}

        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text>
            <Text>{aed(quote.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Discount</Text>
            <Text>- {aed(quote.discount)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>VAT (5%)</Text>
            <Text>{aed(quote.tax)}</Text>
          </View>
          <View style={styles.grandRow}>
            <Text>TOTAL</Text>
            <Text>{aed(quote.total)}</Text>
          </View>
        </View>

        {quote.customerNotes && (
          <View style={styles.notesBox}>
            <Text style={styles.label}>NOTES</Text>
            <Text style={styles.notes}>{quote.customerNotes}</Text>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>Dealflow CRM — fictional demo data. Not a tax invoice.</Text>
          <Text>{quote.quoteNumber}</Text>
        </View>
      </Page>
    </Document>
  );
}
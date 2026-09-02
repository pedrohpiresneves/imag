import { createServerFn } from "@tanstack/react-start";

const EXPECTED = {
  fqdn: "notify.agendamagnetica.net.br",
  txtName: "_lovable-email.agendamagnetica.net.br",
  txtValue:
    "lovable_email_verify=733fc0e9f7dc77f0b30d8086b11a9f7f4c170421a75cb61e9a3f83e70df210ee",
  ns: ["ns5.lovable.cloud", "ns6.lovable.cloud"],
};

type DohAnswer = { name: string; type: number; TTL: number; data: string };
type DohResponse = { Status: number; Answer?: DohAnswer[] };

async function resolve(name: string, type: "NS" | "TXT", resolver: string): Promise<string[]> {
  const url = `${resolver}?name=${encodeURIComponent(name)}&type=${type}`;
  const res = await fetch(url, { headers: { accept: "application/dns-json" } });
  if (!res.ok) return [];
  const json = (await res.json()) as DohResponse;
  if (!json.Answer) return [];
  return json.Answer.filter((a) => (type === "NS" ? a.type === 2 : a.type === 16)).map((a) =>
    a.data.replace(/^"|"$/g, "").replace(/"\s+"/g, "").replace(/\.$/, "").toLowerCase(),
  );
}

export const checkEmailDns = createServerFn({ method: "GET" }).handler(async () => {
  const resolvers = [
    { name: "Google", url: "https://dns.google/resolve" },
    { name: "Cloudflare", url: "https://cloudflare-dns.com/dns-query" },
  ];

  const expectedNs = EXPECTED.ns.map((n) => n.toLowerCase());
  const expectedTxt = EXPECTED.txtValue.toLowerCase();

  const results: Array<{
    resolver: string;
    ns: string[];
    txt: string[];
    nsOk: boolean;
    txtOk: boolean;
  }> = await Promise.all(
    resolvers.map(async (r) => {
      const [ns, txt] = await Promise.all([
        resolve(EXPECTED.fqdn, "NS", r.url).catch(() => [] as string[]),
        resolve(EXPECTED.txtName, "TXT", r.url).catch(() => [] as string[]),
      ]);
      return {
        resolver: r.name,
        ns,
        txt,
        nsOk: expectedNs.every((e) => ns.includes(e)),
        txtOk: txt.some((t) => t.toLowerCase() === expectedTxt),
      };
    }),
  );

  return {
    checkedAt: new Date().toISOString(),
    expected: EXPECTED,
    results,
    allNsOk: results.every((r) => r.nsOk),
    allTxtOk: results.every((r) => r.txtOk),
  };
});

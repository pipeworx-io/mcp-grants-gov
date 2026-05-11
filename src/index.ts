interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Grants.gov MCP — open federal grant opportunities (free, no auth)
 *
 * Sister pack to nih-reporter (awarded grants) and nsf-awards. Grants.gov is
 * the federal-wide clearinghouse for currently-open and forecasted opportunities.
 *
 * API: https://www.grants.gov/web/grants/s2s/grantor/schemas/grants-gov-search2.html
 * Tools:
 * - search_opportunities: filter by keyword, status, agency, funding category, dates
 * - get_opportunity:      single full record with attachments and synopsis text
 */


const BASE_URL = 'https://api.grants.gov/v1/api';

const tools: McpToolExport['tools'] = [
  {
    name: 'search_opportunities',
    description:
      'Search Grants.gov for currently-open or recently-closed federal funding opportunities. Filter by keyword, opportunity status, agency code, funding category, or date range. Returns opportunity number, title, agency, open/close dates, and assistance listing numbers (formerly CFDA).',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Full-text query' },
        status: {
          type: 'string',
          description: 'forecasted | posted | closed | archived (default posted; use a pipe to combine, e.g. "posted|forecasted")',
        },
        agencies: { type: 'string', description: 'Comma-separated agency codes (e.g., "EPA,USDA,NIH")' },
        funding_categories: {
          type: 'string',
          description: 'Comma-separated category codes (e.g., "ED" education, "ENV" environment, "ST" science)',
        },
        aln: { type: 'string', description: 'Assistance Listing Number / CFDA number (e.g., "10.001")' },
        limit: { type: 'number', description: 'Rows per page (1-1000, default 25)' },
        offset: { type: 'number', description: '0-based start record (default 0)' },
      },
      required: [],
    },
  },
  {
    name: 'get_opportunity',
    description:
      'Fetch full details for a Grants.gov opportunity by ID. Returns synopsis text, eligibility, award ceiling/floor, attachments, contact info, and version history.',
    inputSchema: {
      type: 'object',
      properties: {
        opportunity_id: {
          type: 'number',
          description: 'Numeric opportunity ID (returned by search_opportunities as "id")',
        },
      },
      required: ['opportunity_id'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'search_opportunities':
      return searchOpps(args);
    case 'get_opportunity':
      return getOpp(args.opportunity_id as number);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function grantsPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Grants.gov error: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function searchOpps(args: Record<string, unknown>) {
  const body: Record<string, unknown> = {
    rows: Math.min(1000, Math.max(1, (args.limit as number) ?? 25)),
    startRecordNum: (args.offset as number) ?? 0,
    sortBy: 'openDate|desc',
    oppStatuses: (args.status as string) ?? 'posted',
  };
  if (args.keyword) body.keyword = String(args.keyword);
  if (args.agencies) body.agencies = String(args.agencies);
  if (args.funding_categories) body.fundingCategories = String(args.funding_categories);
  if (args.aln) body.cfda = String(args.aln);

  const data = await grantsPost<{
    errorcode?: number;
    msg?: string;
    data?: {
      hitCount?: number;
      oppHits?: SearchHit[];
    };
  }>('/search2', body);

  if (data.errorcode && data.errorcode !== 0) {
    throw new Error(`Grants.gov: ${data.msg ?? 'unknown error'}`);
  }

  const hits = data.data?.oppHits ?? [];
  return {
    total: data.data?.hitCount ?? 0,
    returned: hits.length,
    opportunities: hits.map(normalizeHit),
  };
}

async function getOpp(opportunityId: number) {
  const data = await grantsPost<{
    errorcode?: number;
    msg?: string;
    data?: OpportunityDetail;
  }>('/fetchOpportunity', { opportunityId });

  if (data.errorcode && data.errorcode !== 0) {
    throw new Error(`Grants.gov: ${data.msg ?? `no opportunity ${opportunityId}`}`);
  }
  const d = data.data;
  if (!d) throw new Error(`Grants.gov: no data for opportunity ${opportunityId}`);

  return normalizeDetail(d);
}

interface SearchHit {
  id?: string;
  number?: string;
  title?: string;
  agencyCode?: string;
  agencyName?: string;
  agency?: string;
  openDate?: string;
  closeDate?: string;
  oppStatus?: string;
  docType?: string;
  alnist?: { alnis?: string }[];
}

function normalizeHit(h: SearchHit) {
  return {
    id: h.id ? Number(h.id) : null,
    number: h.number ?? null,
    title: h.title ?? null,
    agency_code: h.agencyCode ?? null,
    agency: h.agencyName ?? h.agency ?? null,
    open_date: h.openDate ?? null,
    close_date: h.closeDate ?? null,
    status: h.oppStatus ?? null,
    doc_type: h.docType ?? null,
    assistance_listing_numbers: (h.alnist ?? []).map((a) => a.alnis).filter(Boolean),
    grants_gov_url: h.id ? `https://www.grants.gov/search-results-detail/${h.id}` : null,
  };
}

interface OpportunityDetail {
  id?: number;
  opportunityNumber?: string;
  opportunityTitle?: string;
  agencyCode?: string;
  agencyName?: string;
  topAgencyDetails?: { agencyCode?: string; agencyName?: string };
  synopsis?: {
    synopsisDesc?: string;
    awardCeiling?: string;
    awardFloor?: string;
    estimatedFunding?: string;
    awardNumber?: string;
    fundingInstrument?: { fundingInstrumentName?: string }[];
    fundingActivityCategories?: { categoryName?: string }[];
    applicantTypes?: { applicantTypeName?: string }[];
    eligibilityDesc?: string;
    agencyContactName?: string;
    agencyContactEmail?: string;
    agencyContactPhone?: string;
    postingDate?: string;
    responseDate?: string;
    closingDateDesc?: string;
    archiveDate?: string;
  };
  cfdas?: { cfdaNumber?: string; programTitle?: string }[];
  synopsisAttachmentFolders?: { folderName?: string; attachments?: { fileName?: string; downloadURL?: string }[] }[];
}

function normalizeDetail(d: OpportunityDetail) {
  const s = d.synopsis ?? {};
  return {
    id: d.id ?? null,
    number: d.opportunityNumber ?? null,
    title: d.opportunityTitle ?? null,
    agency_code: d.agencyCode ?? d.topAgencyDetails?.agencyCode ?? null,
    agency: d.agencyName ?? d.topAgencyDetails?.agencyName ?? null,
    synopsis: s.synopsisDesc ?? null,
    eligibility: s.eligibilityDesc ?? null,
    award_ceiling: s.awardCeiling ? Number(s.awardCeiling) : null,
    award_floor: s.awardFloor ? Number(s.awardFloor) : null,
    estimated_funding: s.estimatedFunding ? Number(s.estimatedFunding) : null,
    expected_awards: s.awardNumber ? Number(s.awardNumber) : null,
    funding_instruments: (s.fundingInstrument ?? []).map((f) => f.fundingInstrumentName).filter(Boolean),
    funding_categories: (s.fundingActivityCategories ?? []).map((c) => c.categoryName).filter(Boolean),
    applicant_types: (s.applicantTypes ?? []).map((a) => a.applicantTypeName).filter(Boolean),
    cfdas: (d.cfdas ?? []).map((c) => ({ number: c.cfdaNumber ?? null, title: c.programTitle ?? null })),
    posting_date: s.postingDate ?? null,
    response_date: s.responseDate ?? null,
    closing_date_desc: s.closingDateDesc ?? null,
    archive_date: s.archiveDate ?? null,
    contact_name: s.agencyContactName ?? null,
    contact_email: s.agencyContactEmail ?? null,
    contact_phone: s.agencyContactPhone ?? null,
    attachments: (d.synopsisAttachmentFolders ?? []).flatMap((f) =>
      (f.attachments ?? []).map((a) => ({
        folder: f.folderName ?? null,
        file_name: a.fileName ?? null,
        download_url: a.downloadURL ?? null,
      })),
    ),
    grants_gov_url: d.id ? `https://www.grants.gov/search-results-detail/${d.id}` : null,
  };
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;

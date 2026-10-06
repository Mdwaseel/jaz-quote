// Thin client for the quotation approval workflow API.
import axios from './axios';
import { Endpoints } from './endpoints';

const data = (res) => res.data.data;
export const errMsg = (e, fallback = 'Something went wrong.') => e?.response?.data?.message || fallback;

export const getRules = async () => data(await axios.post(Endpoints.Quote_Rules, {}));
export const evaluateQuote = async (payload) => data(await axios.post(Endpoints.Evaluate_Quote, payload));
export const getQuote = async (number) =>
  (await axios.get(Endpoints.Get_QuoteDetails, { params: { QuoteId: number } })).data.data.response;
export const getHistory = async (number) => data(await axios.post(Endpoints.Quote_History, { QuotationNumber: number }));
export const createQuote = async (payload) => data(await axios.post(Endpoints.Create_Quote, payload));
export const updateQuote = async (payload) => data(await axios.post(Endpoints.Update_Quote, payload));
export const requestEdit = async (QuotationNumber, Reason, RequestedChanges) =>
  data(await axios.post(Endpoints.Request_Edit, { QuotationNumber, Reason, RequestedChanges }));
export const setSignature = async (QuotationNumber, Kind, Image) =>
  data(await axios.post(Endpoints.Quote_Signature, { QuotationNumber, Kind, Image }));
export const getCompany = async () => data(await axios.post(Endpoints.Admin_Company, {}));
export const saveCompany = async (payload) => data(await axios.post(Endpoints.Admin_Company_Update, payload));
export const sendEsign = async (QuotationNumber, Email) => data(await axios.post(Endpoints.Esign_Send, { QuotationNumber, Email }));
export const signOnsite = async (payload) => data(await axios.post(Endpoints.Esign_Onsite, payload));
export const setDealOutcome = async (payload) => data(await axios.post(Endpoints.Quote_Deal, payload));
export const getDealAnalysis = async (days) => data(await axios.post(Endpoints.Deal_Analysis, { days }));
export const deleteUserPreview = async (userId) => data(await axios.post(Endpoints.User_Delete_Preview, { userId }));
export const deleteUser = async (userId) => data(await axios.post(Endpoints.User_Delete, { userId }));

// Public (no login) — the customer's e-signature page.
const PUBLIC = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8080/api/') + 'public/esign/';
const publicFetch = async (path, opts = {}) => {
  const r = await fetch(PUBLIC + path, opts);
  if (!r.ok) {
    let message = 'Something went wrong. Please try again.';
    try { message = (await r.json()).message || message; } catch { /* keep default */ }
    const err = new Error(message);
    err.status = r.status;
    throw err;
  }
  return r;
};
export const publicEsign = async (token) => (await (await publicFetch(encodeURIComponent(token))).json()).data;
// A plain URL (the token is the credential) so the browser opens the PDF itself — this is what
// works on iPhone/Android and inside mail apps' in-app browsers, unlike blob URLs in pop-ups.
export const publicEsignPdfUrl = (token, download = false) =>
  `${PUBLIC}${encodeURIComponent(token)}/pdf${download ? '?download=1' : ''}`;
export const publicEsignSign = async (token, payload) =>
  (await (await publicFetch(`${encodeURIComponent(token)}/sign`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  })).json()).data;
// Cancelling never deletes: the quotation is kept as "Cancelled" with the reason, and can be restored.
export const cancelQuote = async (QuotationNumber, Reason, Note) => data(await axios.post(Endpoints.Cancel_Quote, { QuotationNumber, Reason, Note }));
export const restoreQuote = async (QuotationNumber, Note) => data(await axios.post(Endpoints.Restore_Quote, { QuotationNumber, Note }));
export const confirmQuote = async (QuoteNumber) => data(await axios.post(Endpoints.Confirm_Quote, { QuoteNumber }));

export const listApprovals = async (scope, filters = {}) => data(await axios.post(Endpoints.Approvals_List, { scope, ...filters }));
export const approvalCounts = async () => data(await axios.post(Endpoints.Approvals_Counts, {}));
export const actOnApproval = async (payload) => data(await axios.post(Endpoints.Approvals_Act, payload));
export const reassignApproval = async (payload) => data(await axios.post(Endpoints.Approvals_Reassign, payload));

export const listNotifications = async () => data(await axios.post(Endpoints.Notifications_List, {}));
export const markNotificationsRead = async (ids) => data(await axios.post(Endpoints.Notifications_Read, { ids }));
export const teamTree = async () => data(await axios.post(Endpoints.Team_Tree, {}));

// Download the approved PDF. Locked quotations return 423 with a reason.
export const downloadQuotePdf = async (QuotationNumber) => {
  try {
    const res = await axios.post(Endpoints.Download_Quote, { QuotationNumber }, { responseType: 'blob' });
    const cd = res.headers['content-disposition'] || '';
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    return {
      url: URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })),
      filename: m ? decodeURIComponent(m[1]) : `${QuotationNumber}.pdf`
    };
  } catch (e) {
    // Blob error bodies need decoding to read the JSON message.
    let message = 'Could not generate the PDF. Please try again.';
    const blob = e?.response?.data;
    if (blob instanceof Blob) {
      try {
        message = JSON.parse(await blob.text()).message || message;
      } catch { /* keep default */ }
    }
    throw new Error(message);
  }
};

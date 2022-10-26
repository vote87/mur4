/**
 * js File to get all variables and const of MUR4 file in order to have a clean js file
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
let objUser;
let url, urlLang;
let buildingCode;
let service;
let domain;
let newUser;
let CDSIDReq;
let CDSIDLL6;
let userLogin;
let displayName;
let userName;
let userCDSID;
let arrayJsonApprovals;
let statusActualReq;
let creatorCDSID;
let Language;
let globalIsSec = true;
let codeExists = false;
let SiteCode;
let arrayDefaultApprovals = [];
let arrayApprovalsNull = [];
let arrayApprovalsLL6 = [];
let arrayAdministrators = [];
let globalAppRandom = [];
let globalJsonApp = [];
let arrayOfAnalistas = [];

let DIGEST = {};
// let POST = {};
// let MERGE = {};

const SURVEY = "Survey";
const COMPLETED = "Completed";
const REJECTED = "Rejected";
const ANALYST = "Analyst";
const CANCELLED = "Cancelled";
const ADMIN = "Admin";
const DOMAIN365 = 'i:0#.f|membership|';
const FORD = '@ford.com';

let LISTAITSERVICES = "IT Services_v2";
let LISTACATALOGOF = "CatalogodeFunciones_v2";
let LISTAUNIVERSALREQUEST = "UniversalRequest";
let LISTAATTACHMENTS = "AttachmentsMUR4";
let LISTAAPPROVALS = "Approvals";
let LISTAANALYSTS = "Analysts";
let LISTALANGUAGES = '';
let buildingCodes;

const PHASE = {
    SEND: "SEND",
    RESEND: "RESEND",
    APPROVE: "APPROVE",
    REJECT: "REJECT",
    CLOSING: "CLOSING",
    CANCELLING: "CANCELLING",
    COMMENTS: "COMMENTS",
    CHANGE: "CHANGE",
    SURVEY: "SURVEY",
    COMPLETED: "COMPLETED"
}
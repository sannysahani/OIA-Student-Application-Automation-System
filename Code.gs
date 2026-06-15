/****************************************************
 * OIA Student Application Management Automation Demo
 * Google Apps Script Portfolio Project
 ****************************************************/

const CONFIG = {
  RESPONSE_SHEET_NAME: "Form Responses 1",
  PDF_FOLDER_NAME: "OIA_Demo_Application_PDFs",

  FULL_NAME_COL: "Full Name",
  STUDENT_ID_COL: "Student ID",
  EMAIL_COL: "Email",
  DEPARTMENT_COL: "Department",
  HOURS_COL: "Available Working Hours",
  EXPERIENCE_COL: "Brief Apps Script / Automation Experience",
  PORTFOLIO_COL: "Resume / Portfolio Link",

  APPLICATION_ID_COL: "Application ID",
  STATUS_COL: "Status",
  REVIEWER_NOTES_COL: "Reviewer Notes",
  PDF_URL_COL: "PDF URL",
  LAST_UPDATED_COL: "Last Updated"
};


/**
 * Run this once manually after pasting the code.
 */
function setupProject() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.RESPONSE_SHEET_NAME);

  if (!sheet) {
    throw new Error("Sheet not found. Check RESPONSE_SHEET_NAME.");
  }

  addMissingSystemColumns_(sheet);
  createFormSubmitTrigger_();
  createEditTrigger_();

  SpreadsheetApp.getUi().alert("Setup completed successfully.");
}


/**
 * Triggered automatically after Google Form submission.
 */
function processFormSubmit(e) {
  const sheet = e.range.getSheet();
  const row = e.range.getRow();

  addMissingSystemColumns_(sheet);

  const headerMap = getHeaderMap_(sheet);
  const rowData = getRowData_(sheet, row, headerMap);

  const applicationId = generateApplicationId_(row);
  const status = "Pending";

  sheet.getRange(row, headerMap[CONFIG.APPLICATION_ID_COL]).setValue(applicationId);
  sheet.getRange(row, headerMap[CONFIG.STATUS_COL]).setValue(status);
  sheet.getRange(row, headerMap[CONFIG.LAST_UPDATED_COL]).setValue(new Date());

  const pdfUrl = generateApplicationPdf_(rowData, applicationId, status);
  sheet.getRange(row, headerMap[CONFIG.PDF_URL_COL]).setValue(pdfUrl);

  sendConfirmationEmail_(
    rowData[CONFIG.EMAIL_COL],
    rowData[CONFIG.FULL_NAME_COL],
    applicationId,
    status
  );
}


/**
 * Triggered automatically when reviewer changes status in the sheet.
 * This updates Last Updated, regenerates the PDF summary, updates the PDF URL,
 * and sends a status update email.
 */
function processStatusEdit(e) {
  const sheet = e.range.getSheet();

  if (sheet.getName() !== CONFIG.RESPONSE_SHEET_NAME) return;

  const row = e.range.getRow();
  if (row === 1) return;

  const headerMap = getHeaderMap_(sheet);
  const editedCol = e.range.getColumn();

  if (editedCol !== headerMap[CONFIG.STATUS_COL]) return;

  const newStatus = e.range.getValue();

  sheet.getRange(row, headerMap[CONFIG.LAST_UPDATED_COL]).setValue(new Date());

  const rowData = getRowData_(sheet, row, headerMap);
  const applicationId = rowData[CONFIG.APPLICATION_ID_COL];

  const updatedPdfUrl = generateApplicationPdf_(rowData, applicationId, newStatus);
  sheet.getRange(row, headerMap[CONFIG.PDF_URL_COL]).setValue(updatedPdfUrl);

  sendStatusUpdateEmail_(
    rowData[CONFIG.EMAIL_COL],
    rowData[CONFIG.FULL_NAME_COL],
    applicationId,
    newStatus
  );
}


/**
 * Web app page.
 */
function doGet(e) {
  return HtmlService
    .createTemplateFromFile("Index")
    .evaluate()
    .setTitle("Application Status Checker")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


/**
 * Called by the web page to check application status.
 */
function lookupApplication(applicationId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.RESPONSE_SHEET_NAME);
  const headerMap = getHeaderMap_(sheet);

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return {
      found: false,
      message: "No applications found."
    };
  }

  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const currentId = row[headerMap[CONFIG.APPLICATION_ID_COL] - 1];

    if (String(currentId).trim() === String(applicationId).trim()) {
      return {
        found: true,
        applicationId: currentId,
        fullName: row[headerMap[CONFIG.FULL_NAME_COL] - 1],
        department: row[headerMap[CONFIG.DEPARTMENT_COL] - 1],
        status: row[headerMap[CONFIG.STATUS_COL] - 1],
        lastUpdated: formatDate_(row[headerMap[CONFIG.LAST_UPDATED_COL] - 1])
      };
    }
  }

  return {
    found: false,
    message: "Application ID not found. Please check and try again."
  };
}


/***********************
 * Helper Functions
 ***********************/

function addMissingSystemColumns_(sheet) {
  const requiredColumns = [
    CONFIG.APPLICATION_ID_COL,
    CONFIG.STATUS_COL,
    CONFIG.REVIEWER_NOTES_COL,
    CONFIG.PDF_URL_COL,
    CONFIG.LAST_UPDATED_COL
  ];

  const existingHeaders = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0];

  requiredColumns.forEach(function(colName) {
    if (!existingHeaders.includes(colName)) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(colName);
    }
  });
}


function createFormSubmitTrigger_() {
  const triggers = ScriptApp.getProjectTriggers();

  const exists = triggers.some(function(trigger) {
    return trigger.getHandlerFunction() === "processFormSubmit";
  });

  if (!exists) {
    ScriptApp
      .newTrigger("processFormSubmit")
      .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
      .onFormSubmit()
      .create();
  }
}


function createEditTrigger_() {
  const triggers = ScriptApp.getProjectTriggers();

  const exists = triggers.some(function(trigger) {
    return trigger.getHandlerFunction() === "processStatusEdit";
  });

  if (!exists) {
    ScriptApp
      .newTrigger("processStatusEdit")
      .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
      .onEdit()
      .create();
  }
}


function getHeaderMap_(sheet) {
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0];

  const headerMap = {};

  headers.forEach(function(header, index) {
    headerMap[header] = index + 1;
  });

  return headerMap;
}


function getRowData_(sheet, row, headerMap) {
  const values = sheet
    .getRange(row, 1, 1, sheet.getLastColumn())
    .getValues()[0];

  const rowData = {};

  Object.keys(headerMap).forEach(function(header) {
    rowData[header] = values[headerMap[header] - 1];
  });

  return rowData;
}


function generateApplicationId_(row) {
  const year = new Date().getFullYear();
  const applicationNumber = Math.max(row - 1, 1);
  const paddedNumber = String(applicationNumber).padStart(4, "0");

  return `OIA-${year}-${paddedNumber}`;
}


function getOrCreateFolder_(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);

  if (folders.hasNext()) {
    return folders.next();
  }

  return DriveApp.createFolder(folderName);
}


function generateApplicationPdf_(rowData, applicationId, status) {
  const folder = getOrCreateFolder_(CONFIG.PDF_FOLDER_NAME);

  const doc = DocumentApp.create(`Application Summary - ${applicationId}`);
  const body = doc.getBody();

  body.appendParagraph("Student Assistant Application Summary")
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);

  body.appendParagraph(`Application ID: ${applicationId}`);
  body.appendParagraph(`Status: ${status}`);
  body.appendParagraph(`Full Name: ${rowData[CONFIG.FULL_NAME_COL] || ""}`);
  body.appendParagraph(`Student ID: ${rowData[CONFIG.STUDENT_ID_COL] || ""}`);
  body.appendParagraph(`Email: ${rowData[CONFIG.EMAIL_COL] || ""}`);
  body.appendParagraph(`Department: ${rowData[CONFIG.DEPARTMENT_COL] || ""}`);

  body.appendParagraph("Available Working Hours")
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(rowData[CONFIG.HOURS_COL] || "");

  body.appendParagraph("Apps Script / Automation Experience")
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(rowData[CONFIG.EXPERIENCE_COL] || "");

  body.appendParagraph("Resume / Portfolio Link")
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(rowData[CONFIG.PORTFOLIO_COL] || "");

  body.appendParagraph(`Generated on: ${new Date()}`);

  doc.saveAndClose();

  const docFile = DriveApp.getFileById(doc.getId());
  const pdfBlob = docFile.getAs(MimeType.PDF);

  const pdfFile = folder
    .createFile(pdfBlob)
    .setName(`Application Summary - ${applicationId}.pdf`);

  docFile.setTrashed(true);

  return pdfFile.getUrl();
}


function sendConfirmationEmail_(email, fullName, applicationId, status) {
  if (!email) return;

  const subject = `Application Received - ${applicationId}`;

  const body =
`Dear ${fullName || "Applicant"},

Thank you for submitting your student assistant application.

Your application has been received successfully.

Application ID: ${applicationId}
Current Status: ${status}

Please keep your Application ID for future reference.

Best regards,
OIA Application Automation Demo`;

  MailApp.sendEmail(email, subject, body);
}


function sendStatusUpdateEmail_(email, fullName, applicationId, status) {
  if (!email) return;

  const subject = `Application Status Updated - ${applicationId}`;

  const body =
`Dear ${fullName || "Applicant"},

Your application status has been updated.

Application ID: ${applicationId}
New Status: ${status}

Best regards,
OIA Application Automation Demo`;

  MailApp.sendEmail(email, subject, body);
}


function formatDate_(dateValue) {
  if (!dateValue) return "";

  return Utilities.formatDate(
    new Date(dateValue),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );
}

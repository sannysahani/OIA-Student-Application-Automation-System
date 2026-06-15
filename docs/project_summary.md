# Project Summary

This project is a Google Apps Script-based automation system for managing student assistant applications.

The workflow starts with a Google Form submission. The submitted data is stored in Google Sheets, where Apps Script automatically generates an Application ID, sets the initial status, sends a confirmation email, and generates a PDF summary.

A reviewer can update the application status directly in Google Sheets. When the status changes, Apps Script automatically updates the timestamp, regenerates the PDF summary, and sends a status update email to the applicant.

The project also includes a simple web-based status checker where applicants can enter their Application ID and view their current status.

This demo shows practical skills in Google Apps Script, Google Sheets automation, form processing, email automation, document generation, review workflows, and front-end integration.

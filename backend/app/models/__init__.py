from app.models.base import Base
from app.models.user import User, Role, Permission, RolePermission, UserRole, AppAdmin, Team, TeamMember
from app.models.ai import AIConfig, AIChatHistory, AIAuditLog, AIPromptTemplate, AIKnowledgeBase
from app.models.drive import DriveFile, DriveFolder, FileTag, FileComment, TrashBin
from app.models.notes import Note, NoteTag, NoteShareRecord, NoteTemplate
from app.models.calendar import CalendarEvent, CalendarSubscription, CalendarCategory
from app.models.forms import Form, FormField, FormResponse, FormTemplate, FormCollaborator
from app.models.projects import Project, Task, Milestone, TimeLog, TaskDependency, ProjectMilestone, TaskAttachment, ProjectTemplate
from app.models.finance import (
    Account, JournalEntry, JournalLine, Invoice, Payment, Budget, BudgetLine, TaxRate,
    RecurringInvoice, Expense, VendorBill, FixedAsset,
)
from app.models.hr import (
    Department, Employee, LeaveRequest, Attendance, SalaryStructure, Payslip,
    EmployeeDocument, Training, TrainingAttendee, PerformanceReview, Benefit, Overtime,
)
from app.models.inventory import (
    Warehouse, InventoryItem, StockLevel, StockMovement, PurchaseOrder, PurchaseOrderLine,
    StockAdjustment, ItemVariant, BatchNumber, InventoryCount,
)
from app.models.inventory import InventorySupplier
from app.models.settings import SystemSettings, UserPreferences
from app.models.notification import Notification
from app.models.crm import Contact, Lead, Opportunity, Deal, Campaign, CampaignContact, CRMProduct, Quote, CRMTicket
from app.models.file_share import FileShare
from app.models.activity import ActivityFeedEntry
from app.models.embedding import DocumentEmbedding
from app.models.support import (
    TicketCategory, Ticket, TicketComment, KnowledgeBaseArticle, SLAPolicy,
    CannedResponse, TicketTag, CustomerSatisfaction,
)
from app.models.supplychain import (
    Supplier, ProcurementRequisition, RequisitionLine,
    GoodsReceivedNote, GRNLine, SupplierReturn, SupplierReturnLine,
    Shipment, ReturnOrder, QualityInspection, SupplierRating, Contract,
)
from app.models.pos import (
    POSSession, POSTransaction, POSTransactionLine, POSPayment,
    POSTerminal, POSDiscount, POSReceipt, POSCashMovement,
)
from app.models.manufacturing import (
    BillOfMaterials, BOMItem, WorkStation, WorkOrder, MaterialConsumption, QualityCheck,
    RoutingStep, ScrapEntry, MaintenanceSchedule, QualityControl,
)
from app.models.ecommerce import (
    Store, EcomProduct, CustomerAccount, ShippingAddress,
    Cart, CartItem, EcomOrder, OrderLine,
    Coupon, ShippingMethod, Review, Wishlist, PaymentGateway,
)
from app.models.license import License, LicenseType
from app.models.sso import SSOProvider, SSOProviderType, SSOUserMapping
from app.models.finance_ext import Currency, ExchangeRate, BankStatement, BankStatementLine, Reconciliation, BankReconciliation
from app.models.payroll_ext import TaxBracket, StatutoryDeduction, PayRun
from app.models.doc_link import DocLink
from app.models.mail import MailRule, MailSignature, ReadReceipt, MailThread, MailLabel, MailFilter
from app.models.meetings import MeetingRecording, MeetingChat, MeetingTemplate, MeetingNote
from app.models.docs import DocumentComment, DocumentTemplate, RecentDocument
from app.models.analytics import Dashboard, DashboardWidget, SavedQuery, Report, DataAlert
from app.models.project_links import ProjectDealLink, ProjectExpenseLink, ProjectDriveFolder, ProjectDocument
from app.models.projects_enhanced import (
    TaskChecklist, TaskRelationship, ProjectCustomField, TaskCustomFieldValue, Sprint,
    RecurringTaskConfig, TaskAuditLog, TaskComment, AutomationRule, ProjectGuestAccess,
)
from app.models.agent import AgentRun, AgentRunStep, AgentApproval
from app.models.handbook import HandbookCategory, HandbookArticle, HandbookFeedback, HandbookProgress, HandbookViewLog

__all__ = [
    "Base",
    # User / Auth
    "User", "Role", "Permission", "RolePermission", "UserRole", "AppAdmin", "Team", "TeamMember",
    # AI
    "AIConfig", "AIChatHistory", "AIAuditLog", "AIPromptTemplate", "AIKnowledgeBase",
    # Drive
    "DriveFile", "DriveFolder", "FileTag", "FileComment", "TrashBin",
    # Notes
    "Note", "NoteTag", "NoteShareRecord", "NoteTemplate",
    # Calendar
    "CalendarEvent", "CalendarSubscription", "CalendarCategory",
    # Forms
    "Form", "FormField", "FormResponse", "FormTemplate", "FormCollaborator",
    # Projects
    "Project", "Task", "Milestone", "TimeLog", "TaskDependency", "ProjectMilestone", "TaskAttachment", "ProjectTemplate",
    # Finance
    "Account", "JournalEntry", "JournalLine", "Invoice", "Payment",
    "Budget", "BudgetLine", "TaxRate",
    "RecurringInvoice", "Expense", "VendorBill", "FixedAsset",
    # HR
    "Department", "Employee", "LeaveRequest", "Attendance", "SalaryStructure", "Payslip",
    "EmployeeDocument", "Training", "TrainingAttendee", "PerformanceReview", "Benefit", "Overtime",
    # Inventory
    "Warehouse", "InventoryItem", "StockLevel", "StockMovement", "PurchaseOrder", "PurchaseOrderLine",
    "InventorySupplier", "StockAdjustment", "ItemVariant", "BatchNumber", "InventoryCount",
    # CRM
    "Contact", "Lead", "Opportunity", "Deal", "Campaign", "CampaignContact", "CRMProduct", "Quote", "CRMTicket",
    # Settings / Notifications
    "SystemSettings", "UserPreferences", "Notification",
    # Shared
    "FileShare", "ActivityFeedEntry", "DocumentEmbedding", "DocLink",
    # Support
    "TicketCategory", "Ticket", "TicketComment", "KnowledgeBaseArticle", "SLAPolicy",
    "CannedResponse", "TicketTag", "CustomerSatisfaction",
    # Supply Chain
    "Supplier", "ProcurementRequisition", "RequisitionLine",
    "GoodsReceivedNote", "GRNLine", "SupplierReturn", "SupplierReturnLine",
    "Shipment", "ReturnOrder", "QualityInspection", "SupplierRating", "Contract",
    # POS
    "POSSession", "POSTransaction", "POSTransactionLine", "POSPayment",
    "POSTerminal", "POSDiscount", "POSReceipt", "POSCashMovement",
    # Manufacturing
    "BillOfMaterials", "BOMItem", "WorkStation", "WorkOrder", "MaterialConsumption", "QualityCheck",
    "RoutingStep", "ScrapEntry", "MaintenanceSchedule", "QualityControl",
    # E-Commerce
    "Store", "EcomProduct", "CustomerAccount", "ShippingAddress",
    "Cart", "CartItem", "EcomOrder", "OrderLine",
    "Coupon", "ShippingMethod", "Review", "Wishlist", "PaymentGateway",
    # License / SSO
    "License", "LicenseType", "SSOProvider", "SSOProviderType", "SSOUserMapping",
    # Finance Ext
    "Currency", "ExchangeRate", "BankStatement", "BankStatementLine", "Reconciliation", "BankReconciliation",
    # Payroll Ext
    "TaxBracket", "StatutoryDeduction", "PayRun",
    # Mail
    "MailRule", "MailSignature", "ReadReceipt", "MailThread", "MailLabel", "MailFilter",
    # Meetings
    "MeetingRecording", "MeetingChat", "MeetingTemplate", "MeetingNote",
    # Docs
    "DocumentComment", "DocumentTemplate", "RecentDocument",
    # Analytics
    "Dashboard", "DashboardWidget", "SavedQuery", "Report", "DataAlert",
    # Project Cross-Module Links
    "ProjectDealLink", "ProjectExpenseLink", "ProjectDriveFolder", "ProjectDocument",
    # Projects Enhanced
    "TaskChecklist", "TaskRelationship", "ProjectCustomField", "TaskCustomFieldValue", "Sprint",
    "RecurringTaskConfig", "TaskAuditLog", "TaskComment", "AutomationRule", "ProjectGuestAccess",
    # Agent (Urban Bad AI)
    "AgentRun", "AgentRunStep", "AgentApproval",
    # Handbook
    "HandbookCategory", "HandbookArticle", "HandbookFeedback", "HandbookProgress", "HandbookViewLog",
]

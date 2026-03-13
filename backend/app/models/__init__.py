from app.models.base import Base, SoftDeleteMixin, OptimisticLockMixin
from app.models.user import (
    User, Role, Permission, RolePermission, UserRole, AppAdmin, Team, TeamMember,
    AppAccess, AppConfig, AuditLog,
)
from app.models.audit_trail import UniversalAuditLog
from app.models.finance_history import JournalEntryHistory, InvoiceHistory
from app.models.ai import AIConfig, AIChatHistory, AIAuditLog, AIPromptTemplate, AIKnowledgeBase
from app.models.drive import (
    DriveFile, DriveFolder, FileTag, FileComment, TrashBin,
    FileAIMetadata, SmartFolder as DriveSmartFolder, SavedView, FileMetadata,
    FileAccessLog, DriveSnapshot, SensitivityLabel,
)
from app.models.drive_phase2 import (
    FileRequest, FileRequestSubmission, DriveWebhook, WebhookDelivery,
    DriveApiKey, DriveTemplate, PersonalVault, DlpRule, DlpViolation,
)
from app.models.drive_phase3 import (
    DriveChangeFeed, DriveUserSequence, CalendarDriveAttachment,
    DriveContentType, DriveContentTypeFolder, AutoBackupRule,
    DriveStorageTier, DriveUserBehavior, DriveAnomalyAlert,
    DriveGuestUser, DriveContractMetadata, DriveAutoLink,
)
from app.models.notes import (
    Note, NoteTag, NoteShareRecord, NoteTemplate,
    Notebook, NotebookSection, NoteEntityLink, NoteVersion,
    NoteComment, NoteCollabSnapshot, NoteCollabUpdate,
    NoteAuditLog, NoteSensitivityLabel,
)
from app.models.calendar import (
    CalendarEvent, CalendarSubscription, CalendarCategory,
    UserCalendar, CalendarPermission, EventAttachment,
    FocusTimeBlock, CalendarRule, CalendarAuditLog,
)
from app.models.calendar_webhooks import CalendarWebhook, CalendarApiKey
from app.models.booking import BookingPage, BookingSlot
from app.models.resource import Resource, ResourceBooking
from app.models.forms import (
    Form, FormField, FormResponse, FormTemplate, FormCollaborator,
    FormFieldOption, FormVersion, FormWebhook, FormAuditLog,
    FormResponseDraft, FormQuizResult, FormSchedule,
    FormApprovalWorkflow, FormResponseApproval, FormTranslation,
    FormConsent, FormConsentRecord, FormAutomation,
)
from app.models.projects import Project, Task, Milestone, TimeLog, TaskDependency, ProjectMilestone, TaskAttachment, ProjectTemplate
from app.models.finance import (
    Account, JournalEntry, JournalLine, Invoice, Payment, Budget, BudgetLine, TaxRate,
    RecurringInvoice, Expense, VendorBill, FixedAsset,
    Estimate, CustomField as FinanceCustomField, Dimension, RevenueRecognitionSchedule,
    WorkflowRule, FinanceWorkflowExecution, DunningLog,
)
from app.models.hr import (
    Department, Employee, LeaveRequest, Attendance, SalaryStructure, Payslip,
    EmployeeDocument, Training, TrainingAttendee, PerformanceReview, Benefit, Overtime,
)
from app.models.inventory import (
    Warehouse, InventoryItem, StockLevel, StockMovement, PurchaseOrder, PurchaseOrderLine,
    StockAdjustment, ItemVariant, BatchNumber, InventoryCount, InventorySupplier,
    # Phase 1
    UnitOfMeasure, UoMConversion, SerialNumber, BlanketOrder,
    # Phase 2
    WarehouseZone, WarehouseBin, BinContent, PutawayRule, PickList, PickListLine,
    # Phase 3
    PurchaseSuggestion, ItemClassification,
    # Phase 4
    Kit, KitComponent, SupplierPriceList,
    LandedCostVoucher, LandedCostLine, LandedCostAllocation,
    # Phase 5
    CostingConfig, CostLayer, InventoryAuditTrail,
    # Phase 6
    InventoryAutomationRule,
)
from app.models.settings import SystemSettings, UserPreferences
from app.models.notification import Notification
from app.models.crm import (
    Contact, Lead, Opportunity, Deal, Campaign, CampaignContact, CRMProduct, Quote, CRMTicket,
    ContactNote, CustomFieldDefinition, DuplicateCandidate, LeadScoringRule, SalesActivity,
    Pipeline, SalesSequence, SequenceStep, SequenceEnrollment, EmailTemplate,
)
from app.models.file_share import FileShare, TeamFolder, TeamFolderMember, ShareAuditLog
from app.models.activity import ActivityFeedEntry
from app.models.embedding import DocumentEmbedding
from app.models.support import (
    TicketCategory, Ticket, TicketComment,
    SupportKnowledgeBaseArticle as KnowledgeBaseArticle,
    SupportSLAPolicy as SLAPolicy,
    CannedResponse, TicketTag, CustomerSatisfaction,
    TicketRoutingRule,
)
from app.models.support_phase1 import (
    LiveChatSession, LiveChatMessage, TicketAuditLog, TicketTimeEntry,
    SavedTicketView, TicketTemplate, InboundEmailRule,
)
from app.models.support_phase2 import (
    SupportAutomation, SupportAutomationLog, CustomerPortalAccount,
    ForumCategory, ForumPost, ForumReply,
    SLAEscalationChain, OmnichannelConfig, TicketFollower,
)
from app.models.support_phase3 import (
    SupportAnalyticsSnapshot, ProactiveRule, VoiceCallRecord,
    AgentSkill, AgentShift, SupportSandbox, CustomerHealthScore,
)
from app.models.supplychain import (
    Supplier, ProcurementRequisition, RequisitionLine,
    GoodsReceivedNote, GRNLine, SupplierReturn, SupplierReturnLine,
    Shipment, ReturnOrder, QualityInspection, SupplierRating, Contract,
)
from app.models.supplychain_planning import (
    ForecastScenario, DemandForecast, DemandSignal,
    SalesOperationsPlan, SupplyPlan, SupplyPlanLine, CapacityPlan,
)
from app.models.supplychain_ops import (
    ControlTowerAlert, SupplyChainKPI, SupplyChainEvent,
    RFx, RFxResponse, SupplierRisk, ReplenishmentRule,
    SafetyStockConfig, StockHealthScore,
    SCWorkflowTemplate, WorkflowRun, WorkflowStep,
    ComplianceRecord, ESGMetric,
)
from app.models.supplychain_advanced import (
    RiskAssessment, RiskScenario, MitigationPlan,
    MRPRun, MRPLine, ProductionSchedule,
)
from app.models.supplychain_logistics import (
    Carrier, Route, TransportOrder, FreightCost,
    DockSchedule, YardSlot,
)
from app.models.session import (
    UserSession, TrustedDevice, SecurityEvent, APIKey,
)
from app.models.pos import (
    POSSession, POSTransaction, POSTransactionLine, POSPayment,
    POSTerminal, POSDiscount, POSReceipt, POSCashMovement,
    POSBundle, POSBundleItem, POSModifierGroup, POSModifier, POSProductModifierLink,
    POSGiftCard, POSGiftCardTransaction, POSStoreCredit, POSStoreCreditTransaction,
    POSPickupOrder, POSPaymentGatewayConfig,
    POSCommissionRule, POSCommission, POSTipPool,
)
from app.models.loyalty import (
    LoyaltyProgram, LoyaltyTier, LoyaltyMember, LoyaltyTransaction, LoyaltyReward,
)
from app.models.kds import KDSStation, KDSOrder, KDSOrderItem
from app.models.manufacturing import (
    BillOfMaterials, BOMItem, WorkStation, WorkOrder, MaterialConsumption, QualityCheck,
    RoutingStep, ScrapEntry, MaintenanceSchedule, QualityControl,
    EngineeringChangeOrder, ECOApproval, MaterialSubstitution, WorkOrderVariance,
    ReworkOrder, InspectionPlan, InspectionPlanItem, NonConformanceReport,
    CAPA, SPCDataPoint, LotSerialTrack, TraceabilityEvent, ElectronicBatchRecord,
    AssetRegister, DowntimeRecord, MaintenanceWorkOrder,
    ProductionScenario, CapacitySlot, ScheduleEntry,
    OperatorSkill, CrewAssignment, IoTDataPoint,
    ConfiguratorRule, ConfiguratorSession,
)
from app.models.ecommerce import (
    Store, EcomProduct, CustomerAccount, ShippingAddress,
    Cart, CartItem, EcomOrder, OrderLine,
    Coupon, ShippingMethod, Review, Wishlist, PaymentGateway,
    CartAbandonmentLog, ProductBundle, BundleItem, FlashSale,
    PickupLocation, EcomOrderWorkOrderLink, EcomOrderProjectLink, ImportJob,
)
from app.models.ecommerce_b2b import EcomCompany, EcomCompanyMember, PricingTier, QuoteRequest, QuoteItem
from app.models.ecommerce_blog import BlogPost
from app.models.ecommerce_currency import EcomCurrency
from app.models.ecommerce_loyalty import (
    EcomLoyaltyProgram, EcomLoyaltyTier, CustomerLoyaltyAccount,
    EcomLoyaltyTransaction, ReferralCode, ReferralUse,
)
from app.models.ecommerce_subscriptions import Subscription, SubscriptionOrder
from app.models.license import License, LicenseType
from app.models.sso import SSOProvider, SSOProviderType, SSOUserMapping
from app.models.finance_ext import (
    Currency, ExchangeRate, BankStatement, BankStatementLine, Reconciliation, BankReconciliation,
    TaxJurisdiction, ComplianceEvent, FXRevaluationEntry, BankCategorizationRule,
)
from app.models.mfa import UserMFA, LoginAttempt
from app.models.payroll_ext import TaxBracket, StatutoryDeduction, PayRun
from app.models.doc_link import DocLink
from app.models.mail import MailRule, MailSignature, ReadReceipt, MailThread, MailLabel, MailFilter
from app.models.meetings import MeetingRecording, MeetingChat, MeetingTemplate, MeetingNote, MeetingLink
from app.models.docs import (
    DocumentComment, DocumentTemplate, RecentDocument, DocumentBookmark,
    SpreadsheetDataConnection, DocumentAuditLog, DocumentSecurity,
    DocumentTemplateCategory, DocumentTemplateFavorite,
)
from app.models.analytics import (
    Dashboard, AnalyticsDashboardWidget, SavedQuery, Report, DataAlert,
    SemanticModel, DataTransformPipeline, DashboardBookmark, DashboardVersion,
    Scorecard, AnalyticsGoal, AnalyticsGoalCheckIn, AnalyticsAuditLog, AnalyticsInsight,
    DashboardRLS, AnalyticsUsageLog, DashboardShare, EmbedToken, DataLineage,
)
from app.models.project_links import ProjectDealLink, ProjectExpenseLink, ProjectDriveFolder, ProjectDocument
from app.models.projects_enhanced import (
    TaskChecklist, TaskRelationship, ProjectCustomField, TaskCustomFieldValue, Sprint,
    RecurringTaskConfig, TaskAuditLog, TaskComment, AutomationRule, ProjectGuestAccess,
)
from app.models.agent import AgentRun, AgentRunStep, AgentApproval
from app.models.handbook import HandbookCategory, HandbookArticle, HandbookFeedback, HandbookProgress, HandbookViewLog
from app.models.mail_storage import MailboxMessage
from app.models.mail_advanced import (
    MailAccount, FocusedInboxScore, SmartFolder, SearchFolder,
    MailCategory, MailQuickStep, MailTemplate, MailPoll, MailContactProfile,
    DLPPolicy, PushSubscription, MailWebhook,
    SharedMailbox, MailAnnotation, MailRetentionPolicy,
)
from app.models.crm_marketing import EmailCampaignConfig, Segment, SegmentContact, ContentCalendarItem, Unsubscribe
from app.models.crm_service import Conversation, ConversationMessage, CRMKnowledgeBaseArticle, CRMSLAPolicy, SLATracker
from app.models.crm_custom_objects import CustomObjectDefinition, CustomObjectRecord, CustomObjectRelationship
from app.models.crm_collaboration import CRMComment, RecordFollower
from app.models.crm_audit import CRMAuditLog
from app.models.crm_automations import CRMWorkflow, WorkflowNode, CRMWorkflowExecution, WorkflowTemplate as CRMWorkflowTemplate
from app.models.crm_ai_agents import CRMAIAgentConfig, CRMAIAgentRun
from app.models.crm_reports import SavedReport, DashboardWidget as CRMDashboardWidget, GamificationScore
from app.models.hr_phase1 import (
    EmployeeSkill, EmployeeSuccessionPlan, EmployeeActivityLog, DocumentVersion,
    CompensationBand, MeritBudgetPool, MeritIncrease, Bonus, EquityGrant,
    ShiftTemplate, ShiftAssignment, HolidayCalendar,
    Goal, GoalUpdate, ContinuousFeedback, ReviewCycle, ReviewAssignment, AuditFieldChange,
)
from app.models.hr_phase2 import (
    JobRequisition, Candidate, CandidateApplication, Interview,
    OnboardingTemplate, OnboardingTask, BuddyAssignment,
    Course, CourseModule, CourseEnrollment, Certification,
    Survey, SurveyResponse, Recognition,
)
from app.models.hr_phase3 import (
    SkillOntology, FlightRiskScore, BurnoutIndicator,
    HRWorkflow, HRWorkflowExecution, WorkflowApproval,
    AnalyticsDashboard as HRAnalyticsDashboard, WorkforcePlanningScenario,
)
from app.models.drive_access_request import FileAccessRequest
from app.models.doc_comment import DocComment, DocVersion
from app.models.chat import (
    Channel, ChannelMember, ChatMessage, MessageReadReceipt,
    ChannelTab, PinnedMessage, UserBookmark,
)
from app.models.chat_extended import (
    SlashCommand, IncomingWebhook, OutgoingWebhook, CallSession,
    ChannelTemplate, SharedChannelLink, MeetingTranscript, MeetingAISummary,
    Whiteboard, RetentionPolicy, DLPRule, DLPViolation, ChatAuditLog,
    LiveEvent, LiveEventRegistration, LiveEventQA, Decision,
    NotificationPreference, TeamsAnalyticsSnapshot,
)
from app.models.note_database import NoteDatabase, NoteDatabaseProperty, NoteDatabaseView, NoteDatabaseRow
from app.models.note_collab import NoteCollabSnapshot, NoteCollabUpdate, NoteComment, NoteVersion
# Note public share links (password-protected, expiry-aware)
from app.models.note_share_link import NoteShareLink
# Note security re-exports (NoteAuditLog, NoteSensitivityLabel already imported above from notes.py)
from app.models.note_security import NoteAuditLog as _NoteAuditLog, NoteSensitivityLabel as _NoteSensitivityLabel  # noqa: F401

__all__ = [
    "Base", "SoftDeleteMixin", "OptimisticLockMixin",
    # Universal Audit Trail
    "UniversalAuditLog",
    # Financial History
    "JournalEntryHistory", "InvoiceHistory",
    # User / Auth
    "User", "Role", "Permission", "RolePermission", "UserRole", "AppAdmin", "Team", "TeamMember",
    "AppAccess", "AppConfig", "AuditLog",
    # AI
    "AIConfig", "AIChatHistory", "AIAuditLog", "AIPromptTemplate", "AIKnowledgeBase",
    # Drive
    "DriveFile", "DriveFolder", "FileTag", "FileComment", "TrashBin",
    "FileAIMetadata", "DriveSmartFolder", "SavedView", "FileMetadata",
    "FileAccessLog", "DriveSnapshot", "SensitivityLabel",
    # Drive Phase 2
    "FileRequest", "FileRequestSubmission", "DriveWebhook", "WebhookDelivery",
    "DriveApiKey", "DriveTemplate", "PersonalVault", "DlpRule", "DlpViolation",
    # Drive Phase 3
    "DriveChangeFeed", "DriveUserSequence", "CalendarDriveAttachment",
    "DriveContentType", "DriveContentTypeFolder", "AutoBackupRule",
    "DriveStorageTier", "DriveUserBehavior", "DriveAnomalyAlert",
    "DriveGuestUser", "DriveContractMetadata", "DriveAutoLink",
    # Notes
    "Note", "NoteTag", "NoteShareRecord", "NoteTemplate",
    "Notebook", "NotebookSection", "NoteEntityLink", "NoteVersion",
    "NoteComment", "NoteCollabSnapshot", "NoteCollabUpdate",
    "NoteAuditLog", "NoteSensitivityLabel",
    # Calendar
    "CalendarEvent", "CalendarSubscription", "CalendarCategory",
    "UserCalendar", "CalendarPermission", "EventAttachment",
    "FocusTimeBlock", "CalendarRule", "CalendarAuditLog",
    "CalendarWebhook", "CalendarApiKey",
    # Booking
    "BookingPage", "BookingSlot",
    # Resources
    "Resource", "ResourceBooking",
    # Forms
    "Form", "FormField", "FormResponse", "FormTemplate", "FormCollaborator",
    "FormFieldOption", "FormVersion", "FormWebhook", "FormAuditLog",
    "FormResponseDraft", "FormQuizResult", "FormSchedule",
    "FormApprovalWorkflow", "FormResponseApproval", "FormTranslation",
    "FormConsent", "FormConsentRecord", "FormAutomation",
    # Projects
    "Project", "Task", "Milestone", "TimeLog", "TaskDependency", "ProjectMilestone", "TaskAttachment", "ProjectTemplate",
    # Finance
    "Account", "JournalEntry", "JournalLine", "Invoice", "Payment",
    "Budget", "BudgetLine", "TaxRate",
    "RecurringInvoice", "Expense", "VendorBill", "FixedAsset",
    "Estimate", "FinanceCustomField", "Dimension", "RevenueRecognitionSchedule",
    "WorkflowRule", "FinanceWorkflowExecution", "DunningLog",
    # HR
    "Department", "Employee", "LeaveRequest", "Attendance", "SalaryStructure", "Payslip",
    "EmployeeDocument", "Training", "TrainingAttendee", "PerformanceReview", "Benefit", "Overtime",
    # Inventory
    "Warehouse", "InventoryItem", "StockLevel", "StockMovement", "PurchaseOrder", "PurchaseOrderLine",
    "InventorySupplier", "StockAdjustment", "ItemVariant", "BatchNumber", "InventoryCount",
    "UnitOfMeasure", "UoMConversion", "SerialNumber", "BlanketOrder",
    "WarehouseZone", "WarehouseBin", "BinContent", "PutawayRule", "PickList", "PickListLine",
    "PurchaseSuggestion", "ItemClassification",
    "Kit", "KitComponent", "SupplierPriceList", "LandedCostVoucher", "LandedCostLine", "LandedCostAllocation",
    "CostingConfig", "CostLayer", "InventoryAuditTrail", "InventoryAutomationRule",
    # CRM
    "Contact", "Lead", "Opportunity", "Deal", "Campaign", "CampaignContact", "CRMProduct", "Quote", "CRMTicket",
    "ContactNote", "CustomFieldDefinition", "DuplicateCandidate", "LeadScoringRule", "SalesActivity",
    "Pipeline", "SalesSequence", "SequenceStep", "SequenceEnrollment", "EmailTemplate",
    # Settings / Notifications
    "SystemSettings", "UserPreferences", "Notification",
    # Shared
    "FileShare", "TeamFolder", "TeamFolderMember", "ShareAuditLog",
    "ActivityFeedEntry", "DocumentEmbedding", "DocLink",
    # Support
    "TicketCategory", "Ticket", "TicketComment", "KnowledgeBaseArticle", "SLAPolicy",
    "CannedResponse", "TicketTag", "CustomerSatisfaction", "TicketRoutingRule",
    # Support Phase 1
    "LiveChatSession", "LiveChatMessage", "TicketAuditLog", "TicketTimeEntry",
    "SavedTicketView", "TicketTemplate", "InboundEmailRule",
    # Support Phase 2
    "SupportAutomation", "SupportAutomationLog", "CustomerPortalAccount",
    "ForumCategory", "ForumPost", "ForumReply",
    "SLAEscalationChain", "OmnichannelConfig", "TicketFollower",
    # Support Phase 3
    "SupportAnalyticsSnapshot", "ProactiveRule", "VoiceCallRecord",
    "AgentSkill", "AgentShift", "SupportSandbox", "CustomerHealthScore",
    # Supply Chain
    "Supplier", "ProcurementRequisition", "RequisitionLine",
    "GoodsReceivedNote", "GRNLine", "SupplierReturn", "SupplierReturnLine",
    "Shipment", "ReturnOrder", "QualityInspection", "SupplierRating", "Contract",
    # Supply Chain Planning
    "ForecastScenario", "DemandForecast", "DemandSignal",
    "SalesOperationsPlan", "SupplyPlan", "SupplyPlanLine", "CapacityPlan",
    # Supply Chain Ops
    "ControlTowerAlert", "SupplyChainKPI", "SupplyChainEvent",
    "RFx", "RFxResponse", "SupplierRisk", "ReplenishmentRule",
    "SafetyStockConfig", "StockHealthScore",
    "SCWorkflowTemplate", "WorkflowRun", "WorkflowStep",
    "ComplianceRecord", "ESGMetric",
    # POS
    "POSSession", "POSTransaction", "POSTransactionLine", "POSPayment",
    "POSTerminal", "POSDiscount", "POSReceipt", "POSCashMovement",
    "POSBundle", "POSBundleItem", "POSModifierGroup", "POSModifier", "POSProductModifierLink",
    "POSGiftCard", "POSGiftCardTransaction", "POSStoreCredit", "POSStoreCreditTransaction",
    "POSPickupOrder", "POSPaymentGatewayConfig",
    "POSCommissionRule", "POSCommission", "POSTipPool",
    # Loyalty
    "LoyaltyProgram", "LoyaltyTier", "LoyaltyMember", "LoyaltyTransaction", "LoyaltyReward",
    # KDS
    "KDSStation", "KDSOrder", "KDSOrderItem",
    # Manufacturing
    "BillOfMaterials", "BOMItem", "WorkStation", "WorkOrder", "MaterialConsumption", "QualityCheck",
    "RoutingStep", "ScrapEntry", "MaintenanceSchedule", "QualityControl",
    "EngineeringChangeOrder", "ECOApproval", "MaterialSubstitution", "WorkOrderVariance",
    "ReworkOrder", "InspectionPlan", "InspectionPlanItem", "NonConformanceReport",
    "CAPA", "SPCDataPoint", "LotSerialTrack", "TraceabilityEvent", "ElectronicBatchRecord",
    "AssetRegister", "DowntimeRecord", "MaintenanceWorkOrder",
    "ProductionScenario", "CapacitySlot", "ScheduleEntry",
    "OperatorSkill", "CrewAssignment", "IoTDataPoint",
    "ConfiguratorRule", "ConfiguratorSession",
    # E-Commerce
    "Store", "EcomProduct", "CustomerAccount", "ShippingAddress",
    "Cart", "CartItem", "EcomOrder", "OrderLine",
    "Coupon", "ShippingMethod", "Review", "Wishlist", "PaymentGateway",
    "CartAbandonmentLog", "ProductBundle", "BundleItem", "FlashSale",
    "PickupLocation", "EcomOrderWorkOrderLink", "EcomOrderProjectLink", "ImportJob",
    # E-Commerce B2B
    "EcomCompany", "EcomCompanyMember", "PricingTier", "QuoteRequest", "QuoteItem",
    # E-Commerce Blog
    "BlogPost",
    # E-Commerce Currency
    "EcomCurrency",
    # E-Commerce Loyalty
    "EcomLoyaltyProgram", "EcomLoyaltyTier", "CustomerLoyaltyAccount",
    "EcomLoyaltyTransaction", "ReferralCode", "ReferralUse",
    # E-Commerce Subscriptions
    "Subscription", "SubscriptionOrder",
    # License / SSO
    "License", "LicenseType", "SSOProvider", "SSOProviderType", "SSOUserMapping",
    # Finance Ext
    "Currency", "ExchangeRate", "BankStatement", "BankStatementLine", "Reconciliation", "BankReconciliation",
    "TaxJurisdiction", "ComplianceEvent", "FXRevaluationEntry", "BankCategorizationRule",
    # MFA
    "UserMFA", "LoginAttempt",
    # Payroll Ext
    "TaxBracket", "StatutoryDeduction", "PayRun",
    # Mail
    "MailRule", "MailSignature", "ReadReceipt", "MailThread", "MailLabel", "MailFilter",
    # Mail Advanced
    "MailAccount", "FocusedInboxScore", "SmartFolder", "SearchFolder",
    "MailCategory", "MailQuickStep", "MailTemplate", "MailPoll", "MailContactProfile",
    "DLPPolicy", "PushSubscription", "MailWebhook",
    "SharedMailbox", "MailAnnotation", "MailRetentionPolicy",
    # Mail Storage
    "MailboxMessage",
    # Meetings
    "MeetingRecording", "MeetingChat", "MeetingTemplate", "MeetingNote", "MeetingLink",
    # Docs
    "DocumentComment", "DocumentTemplate", "RecentDocument", "DocumentBookmark",
    "SpreadsheetDataConnection", "DocumentAuditLog", "DocumentSecurity",
    "DocumentTemplateCategory", "DocumentTemplateFavorite",
    # Analytics
    "Dashboard", "AnalyticsDashboardWidget", "SavedQuery", "Report", "DataAlert",
    "SemanticModel", "DataTransformPipeline", "DashboardBookmark", "DashboardVersion",
    "Scorecard", "AnalyticsGoal", "AnalyticsGoalCheckIn", "AnalyticsAuditLog", "AnalyticsInsight",
    "DashboardRLS", "AnalyticsUsageLog", "DashboardShare", "EmbedToken",
    # Project Cross-Module Links
    "ProjectDealLink", "ProjectExpenseLink", "ProjectDriveFolder", "ProjectDocument",
    # Projects Enhanced
    "TaskChecklist", "TaskRelationship", "ProjectCustomField", "TaskCustomFieldValue", "Sprint",
    "RecurringTaskConfig", "TaskAuditLog", "TaskComment", "AutomationRule", "ProjectGuestAccess",
    # Agent (Urban Bad AI)
    "AgentRun", "AgentRunStep", "AgentApproval",
    # Handbook
    "HandbookCategory", "HandbookArticle", "HandbookFeedback", "HandbookProgress", "HandbookViewLog",
    # CRM Marketing
    "EmailCampaignConfig", "Segment", "SegmentContact", "ContentCalendarItem", "Unsubscribe",
    # CRM Service
    "Conversation", "ConversationMessage", "CRMKnowledgeBaseArticle", "CRMSLAPolicy", "SLATracker",
    # CRM Custom Objects
    "CustomObjectDefinition", "CustomObjectRecord", "CustomObjectRelationship",
    # CRM Collaboration
    "CRMComment", "RecordFollower",
    # CRM Audit
    "CRMAuditLog",
    # CRM Automations
    "CRMWorkflow", "WorkflowNode", "CRMWorkflowExecution", "CRMWorkflowTemplate",
    # CRM AI Agents
    "CRMAIAgentConfig", "CRMAIAgentRun",
    # CRM Reports
    "SavedReport", "CRMDashboardWidget", "GamificationScore",
    # HR Phase 1
    "EmployeeSkill", "EmployeeSuccessionPlan", "EmployeeActivityLog", "DocumentVersion",
    "CompensationBand", "MeritBudgetPool", "MeritIncrease", "Bonus", "EquityGrant",
    "ShiftTemplate", "ShiftAssignment", "HolidayCalendar",
    "Goal", "GoalUpdate", "ContinuousFeedback", "ReviewCycle", "ReviewAssignment", "AuditFieldChange",
    # HR Phase 2
    "JobRequisition", "Candidate", "CandidateApplication", "Interview",
    "OnboardingTemplate", "OnboardingTask", "BuddyAssignment",
    "Course", "CourseModule", "CourseEnrollment", "Certification",
    "Survey", "SurveyResponse", "Recognition",
    # HR Phase 3
    "SkillOntology", "FlightRiskScore", "BurnoutIndicator",
    "HRWorkflow", "HRWorkflowExecution", "WorkflowApproval",
    "HRAnalyticsDashboard", "WorkforcePlanningScenario",
    # Drive Access Requests
    "FileAccessRequest",
    # Doc Comments
    "DocComment", "DocVersion",
    # Chat & Channels (Y&U Teams)
    "Channel", "ChannelMember", "ChatMessage", "MessageReadReceipt",
    "ChannelTab", "PinnedMessage", "UserBookmark",
    # Chat Extended (Phase 2-3)
    "SlashCommand", "IncomingWebhook", "OutgoingWebhook", "CallSession",
    "ChannelTemplate", "SharedChannelLink", "MeetingTranscript", "MeetingAISummary",
    "Whiteboard", "RetentionPolicy", "DLPRule", "DLPViolation", "ChatAuditLog",
    "LiveEvent", "LiveEventRegistration", "LiveEventQA", "Decision",
    "NotificationPreference", "TeamsAnalyticsSnapshot",
    # Note Databases (Notion-style)
    "NoteDatabase", "NoteDatabaseProperty", "NoteDatabaseView", "NoteDatabaseRow",
    # Note public share links
    "NoteShareLink",
    # Supply Chain Advanced
    "RiskAssessment", "RiskScenario", "MitigationPlan",
    "MRPRun", "MRPLine", "ProductionSchedule",
    # Supply Chain Logistics
    "Carrier", "Route", "TransportOrder", "FreightCost",
    "DockSchedule", "YardSlot",
    # Session / Security
    "UserSession", "TrustedDevice", "SecurityEvent", "APIKey",
]

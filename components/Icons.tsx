import React from 'react';
import { 
  Upload, 
  FileText, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Download,
  Languages,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  Archive,
  Eye,
  History,
  Book,
  Settings,
  Split,
  Plus,
  Save,
  Import,
  Search,
  Edit2,
  Image as ImageIcon,
  HelpCircle,
  Presentation,
  RefreshCw,
  Shield
} from 'lucide-react';

export const IconUpload = ({ className }: { className?: string }) => <Upload className={className} />;
export const IconMarkdown = ({ className }: { className?: string }) => <FileText className={className} />;
export const IconExcel = ({ className }: { className?: string }) => <FileSpreadsheet className={className} />;
export const IconPptx = ({ className }: { className?: string }) => <Presentation className={className} />;
export const IconImage = ({ className }: { className?: string }) => <ImageIcon className={className} />;
export const IconSuccess = ({ className }: { className?: string }) => <CheckCircle className={className} />;
export const IconError = ({ className }: { className?: string }) => <AlertCircle className={className} />;
export const IconLoading = ({ className }: { className?: string }) => <Loader2 className={`animate-spin ${className}`} />;
export const IconDownload = ({ className }: { className?: string }) => <Download className={className} />;
export const IconLanguage = ({ className }: { className?: string }) => <Languages className={className} />;
export const IconClose = ({ className }: { className?: string }) => <X className={className} />;
export const IconChevronDown = ({ className }: { className?: string }) => <ChevronDown className={className} />;
export const IconChevronUp = ({ className }: { className?: string }) => <ChevronUp className={className} />;
export const IconTrash = ({ className }: { className?: string }) => <Trash2 className={className} />;
export const IconZip = ({ className }: { className?: string }) => <Archive className={className} />;
export const IconEye = ({ className }: { className?: string }) => <Eye className={className} />;
export const IconHistory = ({ className }: { className?: string }) => <History className={className} />;
export const IconBook = ({ className }: { className?: string }) => <Book className={className} />;
export const IconSettings = ({ className }: { className?: string }) => <Settings className={className} />;
export const IconSplit = ({ className }: { className?: string }) => <Split className={className} />;
export const IconPlus = ({ className }: { className?: string }) => <Plus className={className} />;
export const IconSave = ({ className }: { className?: string }) => <Save className={className} />;
export const IconImport = ({ className }: { className?: string }) => <Import className={className} />;
export const IconSearch = ({ className }: { className?: string }) => <Search className={className} />;
export const IconEdit = ({ className }: { className?: string }) => <Edit2 className={className} />;
export const IconHelp = ({ className }: { className?: string }) => <HelpCircle className={className} />;
export const IconShield = ({ className }: { className?: string }) => <Shield className={className} />;
export const IconRefresh = ({ className }: { className?: string }) => <RefreshCw className={className} />;
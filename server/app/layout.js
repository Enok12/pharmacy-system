import "./globals.css";
import { ToastProvider } from "@/components/feedback/ToastProvider";

// Deliberately not using next/font/google here: this is a POS system that
// may run on pharmacy-floor machines with unreliable internet, and a build
// that depends on fetching fonts at build time is a fragile default for
// that environment. System font stack (defined in globals.css) is used
// instead — swap in a self-hosted font file later if a brand typeface is
// required.

export const metadata = {
  title: "MedCare Pharmacy | Inventory & POS",
  description: "Pharmacy inventory management and point-of-sale system",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

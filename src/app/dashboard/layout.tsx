import React from "react";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-full w-full flex flex-col bg-slate-900">
      <header className="h-16 w-full flex items-center justify-center px-4 bg-slate-800 border-b border-slate-700">
        <img
          src={"assets/images/SolarSightLogo.svg"}
          alt={"Solar Sight Logo"}
          className="h-12"
        />
      </header>
      <div className="h-full w-full">{children}</div>
    </div>
  );
}

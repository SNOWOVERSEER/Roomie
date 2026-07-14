"use client";

export default function PrintButton() {
  return (
    <button className="noPrint" onClick={() => window.print()}>
      Print
    </button>
  );
}

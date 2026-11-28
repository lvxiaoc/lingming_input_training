import React from 'react';

interface PrintableTopologySheetsProps {
  urls: string[];
}

export const PrintableTopologySheets: React.FC<PrintableTopologySheetsProps> = ({ urls }) => {
  if (urls.length === 0) return null;
  return (
    <div className="print-only-sheets" aria-hidden="true">
      {urls.map((src, idx) => (
        <div key={idx} className="print-a4-page">
          <img src={src} alt={`灵明二十笔势拓扑共性新云图 第 ${idx + 1} 页`} />
        </div>
      ))}
    </div>
  );
};

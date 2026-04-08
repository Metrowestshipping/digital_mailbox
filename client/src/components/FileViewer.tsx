import { X, Download, ExternalLink } from 'lucide-react';

interface Props {
  files: string[];
  onClose: () => void;
}

export function FileViewer({ files, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-800">Scanned Documents ({files.length})</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Files */}
        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {files.map((url, i) => {
            const isPdf = url.toLowerCase().includes('.pdf');
            return (
              <div key={i} className="border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
                  <span className="text-sm text-gray-600">Document {i + 1}</span>
                  <div className="flex gap-2">
                    <a
                      href={url}
                      download
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <Download size={13} /> Download
                    </a>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <ExternalLink size={13} /> Open
                    </a>
                  </div>
                </div>
                {isPdf ? (
                  <iframe
                    src={url}
                    className="w-full h-96"
                    title={`Document ${i + 1}`}
                  />
                ) : (
                  <img
                    src={url}
                    alt={`Document ${i + 1}`}
                    className="w-full object-contain max-h-96"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

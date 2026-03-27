import React, { useState, useRef } from 'react';
import { X, Upload, Download, AlertCircle, CheckCircle2, Image as ImageIcon, Edit2, Trash2 } from 'lucide-react';
import Papa from 'papaparse';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  currentList: any[];
  locations: any[];
  token: string;
  onImportComplete: () => void;
}

export default function BulkImportModal({ isOpen, onClose, activeTab, currentList, locations, token, onImportComplete }: BulkImportModalProps) {
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ total: 0, current: 0, success: 0, failed: 0 });
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<any>(null);
  const [imageInputType, setImageInputType] = useState<'upload' | 'url'>('upload');
  const [contactType, setContactType] = useState<'wechat' | 'email'>('wechat');
  const [contactValue, setContactValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const getColumnsForTab = () => {
    const common = ['name', 'name_zh', 'province_zh', 'city_zh', 'intro', 'contact_info', 'image_url'];
    switch (activeTab) {
      case 'bands': return ['band_id', ...common, 'genre', 'netease_url', 'xiaohongshu_url'];
      case 'venues': return ['venue_id', ...common, 'address', 'capacity', 'ticket_url'];
      case 'rehearsal_rooms': return ['room_id', ...common, 'equipment', 'price_info'];
      case 'spots': return ['spot_id', ...common, 'type', 'business_hours', 'social_url'];
      case 'events': return ['title', 'date_str', 'location', 'intro', 'image_url'];
      default: return common;
    }
  };

  const downloadTemplate = () => {
    const cols = getColumnsForTab();
    const csv = Papa.unparse([cols]);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeTab}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data.map((row: any) => {
          return validateRow(row);
        });
        setParsedData(data);
      }
    });
    
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validateRow = (row: any) => {
    const errors: string[] = [];
    const fieldErrors: Record<string, string> = {};
    let status: 'valid' | 'error' | 'duplicate' | 'imported' = 'valid';
    
    // Auto-generate ID if missing
    let idField = '';
    if (activeTab === 'bands') idField = 'band_id';
    else if (activeTab === 'venues') idField = 'venue_id';
    else if (activeTab === 'rehearsal_rooms') idField = 'room_id';
    else if (activeTab === 'spots') idField = 'spot_id';

    if (idField && !row[idField]) {
      if (row.name) {
        row[idField] = row.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      } else if (row.name_zh) {
        row[idField] = `id-${Math.random().toString(36).substr(2, 9)}`;
      }
    }

    if (idField && !row[idField]) {
      errors.push(`Missing required field: ${idField}`);
      fieldErrors[idField] = 'Required';
      status = 'error';
    }

    // Check required fields
    const nameField = activeTab === 'events' ? 'title' : 'name_zh';
    if (!row[nameField]) {
      errors.push(`Missing required field: ${nameField}`);
      fieldErrors[nameField] = 'Required';
      status = 'error';
    }
    if (activeTab !== 'events' && !row.name) {
      errors.push(`Missing required field: name`);
      fieldErrors.name = 'Required';
      status = 'error';
    }

    // Check tab-specific required fields
    const checkRequired = (field: string, label: string) => {
      if (!row[field]) {
        errors.push(`Missing required field: ${label}`);
        fieldErrors[field] = 'Required';
        status = 'error';
      }
    };

    checkRequired('intro', 'Intro');

    if (activeTab === 'bands') {
      checkRequired('genre', 'Genre');
    } else if (activeTab === 'venues') {
      checkRequired('address', 'Address');
      checkRequired('capacity', 'Capacity');
    } else if (activeTab === 'rehearsal_rooms') {
      checkRequired('address', 'Address');
      checkRequired('equipment', 'Equipment');
      checkRequired('price_info', 'Price Info');
    } else if (activeTab === 'spots') {
      checkRequired('type', 'Type');
      checkRequired('address', 'Address');
      checkRequired('business_hours', 'Business Hours');
    } else if (activeTab === 'events') {
      checkRequired('date_str', 'Date');
      checkRequired('location', 'Location');
    }

    // Check duplicates
    if (row[nameField]) {
      const isDuplicate = currentList.some(item => 
        (activeTab === 'events' ? item.title : item.name_zh) === row[nameField]
      );
      if (isDuplicate) {
        errors.push(`Duplicate entry found for: ${row[nameField]}`);
        fieldErrors[nameField] = 'Duplicate';
        status = 'duplicate';
      }
    }

    // Resolve Province and City IDs
    if (activeTab !== 'events') {
      if (row.province_zh || row.province_id) {
        const cleanProv = (row.province_zh || '').replace(/(省|市|自治区|壮族自治区|回族自治区|维吾尔自治区|特别行政区)$/, '');
        const prov = locations.find(p => p.en === row.province_id || p.zh === cleanProv || p.zh === row.province_zh || p.zh.includes(cleanProv) || cleanProv.includes(p.zh));
        
        if (prov) {
          row.province_id = prov.en;
          row.province_zh = prov.zh; // Normalize to standard name
          
          if (row.city_zh || row.city_id) {
            const cleanCity = (row.city_zh || '').replace(/(市|区|县|自治州|盟)$/, '');
            const city = prov.cities.find((c: any) => c.en === row.city_id || c.zh === cleanCity || c.zh === row.city_zh || c.zh.includes(cleanCity) || cleanCity.includes(c.zh));
            
            if (city) {
              row.city_id = city.en;
              row.city_zh = city.zh; // Normalize to standard name
            } else {
              errors.push(`City "${row.city_zh || row.city_id}" not found in province "${prov.zh}"`);
              fieldErrors.city_id = 'Invalid City';
              status = 'error';
            }
          } else {
            errors.push('Missing city');
            fieldErrors.city_id = 'Required';
            status = 'error';
          }
        } else {
          errors.push(`Province "${row.province_zh || row.province_id}" not found`);
          fieldErrors.province_id = 'Invalid Province';
          status = 'error';
        }
      } else {
        errors.push('Missing province');
        fieldErrors.province_id = 'Required';
        status = 'error';
      }
    }

    return { ...row, _status: status, _errors: errors, _fieldErrors: fieldErrors };
  };

  const editValidation = editingRowIndex !== null && editFormData ? validateRow({...editFormData}) : null;
  const isEditValid = editValidation?._status === 'valid';
  const fieldErrors = editValidation?._fieldErrors || {};

  const handleEditRow = (index: number) => {
    setEditingRowIndex(index);
    const rowData = { ...parsedData[index] };
    setEditFormData(rowData);
    setImageInputType(rowData.image_url && !rowData.image_url.startsWith('/uploads/') ? 'url' : 'upload');

    if (rowData.contact_info) {
      if (rowData.contact_info.toLowerCase().startsWith('email:')) {
        setContactType('email');
        setContactValue(rowData.contact_info.substring(6).trim());
      } else if (rowData.contact_info.toLowerCase().startsWith('wechat:')) {
        setContactType('wechat');
        setContactValue(rowData.contact_info.substring(7).trim());
      } else {
        setContactType('wechat');
        setContactValue(rowData.contact_info);
      }
    } else {
      setContactType('wechat');
      setContactValue('');
    }
  };

  const handleSaveEdit = () => {
    if (editingRowIndex === null) return;
    const newData = [...parsedData];
    
    const updatedFormData = { ...editFormData };
    if (activeTab !== 'events') {
      if (contactValue) {
        updatedFormData.contact_info = `${contactType === 'wechat' ? 'WeChat' : 'Email'}: ${contactValue}`;
      } else {
        updatedFormData.contact_info = '';
      }
    }

    // Re-validate the edited row
    newData[editingRowIndex] = validateRow(updatedFormData);
    setParsedData(newData);
    setEditingRowIndex(null);
    setEditFormData(null);
  };

  const handleDeleteRow = (index: number) => {
    const newData = [...parsedData];
    newData.splice(index, 1);
    setParsedData(newData);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.url) {
        setEditFormData({ ...editFormData, image_url: data.url });
      }
    } catch (err) {
      console.error('Upload failed', err);
      alert('Image upload failed');
    }
  };

  const executeImport = async () => {
    const validRows = parsedData.filter(row => row._status === 'valid');
    if (validRows.length === 0) {
      alert('No valid rows to import.');
      return;
    }

    setIsImporting(true);
    setImportProgress({ total: validRows.length, current: 0, success: 0, failed: 0 });

    let successCount = 0;
    let failedCount = 0;
    
    const newParsedData = [...parsedData];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const originalIndex = parsedData.indexOf(row);
      
      setImportProgress(prev => ({ ...prev, current: i + 1 }));

      const endpoint = activeTab === 'bands' ? '/api/bands' : 
                       activeTab === 'venues' ? '/api/venues' : 
                       activeTab === 'events' ? '/api/featured_events' : 
                       activeTab === 'rehearsal_rooms' ? '/api/rehearsal_rooms' : '/api/spots';

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(row)
        });

        if (res.ok) {
          successCount++;
          newParsedData[originalIndex] = { ...row, _status: 'imported' };
        } else {
          failedCount++;
          const errorData = await res.json().catch(() => ({}));
          newParsedData[originalIndex] = { 
            ...row, 
            _status: 'error', 
            _errors: [...(row._errors || []), `Import failed: ${errorData.error || res.statusText}`] 
          };
        }
      } catch (err: any) {
        failedCount++;
        newParsedData[originalIndex] = { 
          ...row, 
          _status: 'error', 
          _errors: [...(row._errors || []), `Network error: ${err.message}`] 
        };
      }
      
      // Update state progressively so user sees it
      setParsedData([...newParsedData]);
    }

    setImportProgress(prev => ({ ...prev, success: successCount, failed: failedCount }));
    setIsImporting(false);
    
    if (successCount > 0 && failedCount === 0) {
      onImportComplete();
    } else if (successCount > 0) {
      // Partial success, don't auto-close so user can see errors
      alert(`Import completed with ${failedCount} errors. Successfully imported ${successCount} items.`);
    } else if (failedCount > 0) {
      alert(`Import failed for all ${failedCount} items. Please check the errors.`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-white/10">
          <h2 className="text-2xl font-serif text-white">Bulk Import {activeTab.replace('_', ' ')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-hidden flex flex-col">
          {/* Controls */}
          <div className="flex gap-4 mb-6">
            <button 
              onClick={downloadTemplate}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors text-sm"
            >
              <Download size={16} /> Download CSV Template
            </button>
            <label className="flex items-center gap-2 bg-[#ff4e00] hover:bg-[#ff4e00]/90 text-white px-4 py-2 rounded-lg transition-colors cursor-pointer text-sm">
              <Upload size={16} /> Upload CSV File
              <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            </label>
          </div>

          {/* Preview Table */}
          {parsedData.length > 0 && (
            <div className="flex-1 overflow-auto border border-white/10 rounded-lg bg-black/30 custom-scrollbar relative">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-xs text-gray-400 uppercase bg-white/5 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Name</th>
                    {activeTab !== 'events' && <th className="px-4 py-3">Location</th>}
                    <th className="px-4 py-3">Image</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.map((row, idx) => (
                    <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3">
                        {row._status === 'valid' && <span className="flex items-center gap-1 text-green-400"><CheckCircle2 size={14} /> Valid</span>}
                        {row._status === 'imported' && <span className="flex items-center gap-1 text-blue-400"><CheckCircle2 size={14} /> Imported</span>}
                        {row._status === 'error' && (
                          <div className="flex items-center gap-1 text-red-400 group relative cursor-help">
                            <AlertCircle size={14} /> Error
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-black border border-red-500/30 text-red-400 p-2 rounded text-xs whitespace-nowrap z-20">
                              {row._errors.map((e: string, i: number) => <div key={i}>{e}</div>)}
                            </div>
                          </div>
                        )}
                        {row._status === 'duplicate' && (
                          <div className="flex items-center gap-1 text-yellow-400 group relative cursor-help">
                            <AlertCircle size={14} /> Skip (Exists)
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-black border border-yellow-500/30 text-yellow-400 p-2 rounded text-xs whitespace-nowrap z-20">
                              {row._errors.map((e: string, i: number) => <div key={i}>{e}</div>)}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">
                        {activeTab === 'events' ? row.title : (row.name_zh || row.name)}
                      </td>
                      {activeTab !== 'events' && (
                        <td className="px-4 py-3">{row.province_zh} {row.city_zh}</td>
                      )}
                      <td className="px-4 py-3">
                        {row.image_url ? (
                          <img src={row.image_url} alt="preview" className="w-8 h-8 object-cover rounded" />
                        ) : (
                          <span className="text-gray-500 text-xs">No image</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleEditRow(idx)} className="text-blue-400 hover:text-blue-300 p-1 mr-2">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDeleteRow(idx)} className="text-red-400 hover:text-red-300 p-1">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Import Summary & Action */}
          {parsedData.length > 0 && !isImporting && (
            <div className="mt-6 flex items-center justify-between bg-white/5 p-4 rounded-lg">
              <div className="flex gap-6 text-sm">
                <span className="text-white">Total: <strong>{parsedData.length}</strong></span>
                <span className="text-green-400">Valid: <strong>{parsedData.filter(r => r._status === 'valid').length}</strong></span>
                <span className="text-yellow-400">Skip: <strong>{parsedData.filter(r => r._status === 'duplicate').length}</strong></span>
                <span className="text-red-400">Errors: <strong>{parsedData.filter(r => r._status === 'error').length}</strong></span>
              </div>
              <button 
                onClick={executeImport}
                disabled={parsedData.filter(r => r._status === 'valid').length === 0}
                className="bg-[#ff4e00] hover:bg-[#ff4e00]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Import Valid Rows
              </button>
            </div>
          )}

          {/* Importing Progress */}
          {isImporting && (
            <div className="mt-6 bg-white/5 p-6 rounded-lg text-center">
              <h3 className="text-lg font-medium text-white mb-2">Importing...</h3>
              <div className="w-full bg-black/50 rounded-full h-2 mb-4 overflow-hidden">
                <div 
                  className="bg-[#ff4e00] h-2 transition-all duration-300" 
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-400">
                Processed {importProgress.current} of {importProgress.total}
              </p>
              {importProgress.current === importProgress.total && (
                <div className="mt-4 flex justify-center gap-4 text-sm">
                  <span className="text-green-400">Success: {importProgress.success}</span>
                  <span className="text-red-400">Failed: {importProgress.failed}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Row Modal */}
      {editingRowIndex !== null && editFormData && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl w-full max-w-2xl p-6">
            <h3 className="text-xl font-medium text-white mb-4">Edit Row Data</h3>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {/* Image Upload Section */}
              <div className="bg-black/30 p-4 rounded-lg border border-white/5">
                <label className="block text-sm text-gray-400 mb-2">Image</label>
                <div className="flex gap-4 mb-3">
                  <button type="button" onClick={() => setImageInputType('upload')} className={`text-sm px-3 py-1 rounded ${imageInputType === 'upload' ? 'bg-[#ff4e00] text-white' : 'bg-white/10 text-gray-400'}`}>Upload</button>
                  <button type="button" onClick={() => setImageInputType('url')} className={`text-sm px-3 py-1 rounded ${imageInputType === 'url' ? 'bg-[#ff4e00] text-white' : 'bg-white/10 text-gray-400'}`}>URL</button>
                </div>
                {imageInputType === 'upload' ? (
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded cursor-pointer text-sm transition-colors">
                      <ImageIcon size={16} /> Choose Image
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                    {editFormData.image_url && <img src={editFormData.image_url} alt="preview" className="h-10 w-10 object-cover rounded" />}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={editFormData.image_url || ''}
                    onChange={(e) => setEditFormData({...editFormData, image_url: e.target.value})}
                    placeholder="https://example.com/image.jpg"
                    className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ff4e00]"
                  />
                )}
              </div>

              {/* Dynamic Fields */}
              <div className="grid grid-cols-2 gap-4">
                {/* Location Dropdowns */}
                {activeTab !== 'events' && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 uppercase">Province</label>
                      <select
                        value={editFormData.province_id || ''}
                        onChange={(e) => {
                          const prov = locations.find(p => p.en === e.target.value);
                          setEditFormData({...editFormData, province_id: prov?.en, province_zh: prov?.zh, city_id: '', city_zh: ''});
                        }}
                        className={`w-full bg-black/50 border ${fieldErrors.province_id ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#ff4e00]'} rounded px-3 py-2 text-sm text-white focus:outline-none`}
                      >
                        <option value="" disabled>Select Province</option>
                        {locations.map(p => (
                          <option key={p.en} value={p.en}>{p.zh} ({p.en})</option>
                        ))}
                      </select>
                      {fieldErrors.province_id && <span className="text-red-500 text-xs mt-1">{fieldErrors.province_id}</span>}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 uppercase">City</label>
                      <select
                        value={editFormData.city_id || ''}
                        onChange={(e) => {
                          const prov = locations.find(p => p.en === editFormData.province_id);
                          const city = prov?.cities.find((c: any) => c.en === e.target.value);
                          setEditFormData({...editFormData, city_id: city?.en, city_zh: city?.zh});
                        }}
                        disabled={!editFormData.province_id}
                        className={`w-full bg-black/50 border ${fieldErrors.city_id ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#ff4e00]'} rounded px-3 py-2 text-sm text-white disabled:opacity-50 focus:outline-none`}
                      >
                        <option value="" disabled>Select City</option>
                        {editFormData.province_id && locations.find(p => p.en === editFormData.province_id)?.cities.map((c: any) => (
                          <option key={c.en} value={c.en}>{c.zh} ({c.en})</option>
                        ))}
                      </select>
                      {fieldErrors.city_id && <span className="text-red-500 text-xs mt-1">{fieldErrors.city_id}</span>}
                    </div>
                  </>
                )}

                {/* IDs */}
                {activeTab === 'bands' && (
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1 uppercase">Band ID</label>
                    <input type="text" value={editFormData.band_id || ''} onChange={e => setEditFormData({...editFormData, band_id: e.target.value})} className={`w-full bg-black/50 border ${fieldErrors.band_id ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#ff4e00]'} rounded px-3 py-2 text-sm text-white focus:outline-none`} />
                    {fieldErrors.band_id && <span className="text-red-500 text-xs mt-1">{fieldErrors.band_id}</span>}
                  </div>
                )}
                {activeTab === 'venues' && (
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1 uppercase">Venue ID</label>
                    <input type="text" value={editFormData.venue_id || ''} onChange={e => setEditFormData({...editFormData, venue_id: e.target.value})} className={`w-full bg-black/50 border ${fieldErrors.venue_id ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#ff4e00]'} rounded px-3 py-2 text-sm text-white focus:outline-none`} />
                    {fieldErrors.venue_id && <span className="text-red-500 text-xs mt-1">{fieldErrors.venue_id}</span>}
                  </div>
                )}
                {activeTab === 'rehearsal_rooms' && (
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1 uppercase">Room ID</label>
                    <input type="text" value={editFormData.room_id || ''} onChange={e => setEditFormData({...editFormData, room_id: e.target.value})} className={`w-full bg-black/50 border ${fieldErrors.room_id ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#ff4e00]'} rounded px-3 py-2 text-sm text-white focus:outline-none`} />
                    {fieldErrors.room_id && <span className="text-red-500 text-xs mt-1">{fieldErrors.room_id}</span>}
                  </div>
                )}
                {activeTab === 'spots' && (
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1 uppercase">Spot ID</label>
                    <input type="text" value={editFormData.spot_id || ''} onChange={e => setEditFormData({...editFormData, spot_id: e.target.value})} className={`w-full bg-black/50 border ${fieldErrors.spot_id ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#ff4e00]'} rounded px-3 py-2 text-sm text-white focus:outline-none`} />
                    {fieldErrors.spot_id && <span className="text-red-500 text-xs mt-1">{fieldErrors.spot_id}</span>}
                  </div>
                )}

                {/* Events */}
                {activeTab === 'events' && (
                  <>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1 uppercase">Event Title</label>
                      <input type="text" value={editFormData.title || ''} onChange={e => setEditFormData({...editFormData, title: e.target.value})} className={`w-full bg-black/50 border ${fieldErrors.title ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#ff4e00]'} rounded px-3 py-2 text-sm text-white focus:outline-none`} />
                      {fieldErrors.title && <span className="text-red-500 text-xs mt-1">{fieldErrors.title}</span>}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 uppercase">Date</label>
                      <input type="text" value={editFormData.date_str || ''} onChange={e => setEditFormData({...editFormData, date_str: e.target.value})} className={`w-full bg-black/50 border ${fieldErrors.date_str ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#ff4e00]'} rounded px-3 py-2 text-sm text-white focus:outline-none`} />
                      {fieldErrors.date_str && <span className="text-red-500 text-xs mt-1">{fieldErrors.date_str}</span>}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 uppercase">Location Name</label>
                      <input type="text" value={editFormData.location || ''} onChange={e => setEditFormData({...editFormData, location: e.target.value})} className={`w-full bg-black/50 border ${fieldErrors.location ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#ff4e00]'} rounded px-3 py-2 text-sm text-white focus:outline-none`} />
                      {fieldErrors.location && <span className="text-red-500 text-xs mt-1">{fieldErrors.location}</span>}
                    </div>
                  </>
                )}

                {/* Common Names */}
                {activeTab !== 'events' && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 uppercase">Name (副标题)</label>
                      <input type="text" value={editFormData.name || ''} onChange={e => setEditFormData({...editFormData, name: e.target.value})} className={`w-full bg-black/50 border ${fieldErrors.name ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#ff4e00]'} rounded px-3 py-2 text-sm text-white focus:outline-none`} />
                      {fieldErrors.name && <span className="text-red-500 text-xs mt-1">{fieldErrors.name}</span>}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 uppercase">Name (主标题)</label>
                      <input type="text" value={editFormData.name_zh || ''} onChange={e => setEditFormData({...editFormData, name_zh: e.target.value})} className={`w-full bg-black/50 border ${fieldErrors.name_zh ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#ff4e00]'} rounded px-3 py-2 text-sm text-white focus:outline-none`} />
                      {fieldErrors.name_zh && <span className="text-red-500 text-xs mt-1">{fieldErrors.name_zh}</span>}
                    </div>
                  </>
                )}

                {/* Specifics */}
                {activeTab === 'bands' && (
                  <>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1 uppercase">Genre</label>
                      <input type="text" value={editFormData.genre || ''} onChange={e => setEditFormData({...editFormData, genre: e.target.value})} className={`w-full bg-black/50 border ${fieldErrors.genre ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#ff4e00]'} rounded px-3 py-2 text-sm text-white focus:outline-none`} />
                      {fieldErrors.genre && <span className="text-red-500 text-xs mt-1">{fieldErrors.genre}</span>}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 uppercase">NetEase URL</label>
                      <input type="text" value={editFormData.netease_url || ''} onChange={e => setEditFormData({...editFormData, netease_url: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ff4e00]" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 uppercase">Xiaohongshu URL</label>
                      <input type="text" value={editFormData.xiaohongshu_url || ''} onChange={e => setEditFormData({...editFormData, xiaohongshu_url: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ff4e00]" />
                    </div>
                  </>
                )}

                {activeTab === 'venues' && (
                  <>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1 uppercase">Address</label>
                      <input type="text" value={editFormData.address || ''} onChange={e => setEditFormData({...editFormData, address: e.target.value})} className={`w-full bg-black/50 border ${fieldErrors.address ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#ff4e00]'} rounded px-3 py-2 text-sm text-white focus:outline-none`} />
                      {fieldErrors.address && <span className="text-red-500 text-xs mt-1">{fieldErrors.address}</span>}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 uppercase">Capacity</label>
                      <input type="number" value={editFormData.capacity || ''} onChange={e => setEditFormData({...editFormData, capacity: e.target.value})} className={`w-full bg-black/50 border ${fieldErrors.capacity ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#ff4e00]'} rounded px-3 py-2 text-sm text-white focus:outline-none`} />
                      {fieldErrors.capacity && <span className="text-red-500 text-xs mt-1">{fieldErrors.capacity}</span>}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 uppercase">Ticket URL</label>
                      <input type="text" value={editFormData.ticket_url || ''} onChange={e => setEditFormData({...editFormData, ticket_url: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ff4e00]" />
                    </div>
                  </>
                )}

                {activeTab === 'rehearsal_rooms' && (
                  <>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1 uppercase">Address</label>
                      <input type="text" value={editFormData.address || ''} onChange={e => setEditFormData({...editFormData, address: e.target.value})} className={`w-full bg-black/50 border ${fieldErrors.address ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#ff4e00]'} rounded px-3 py-2 text-sm text-white focus:outline-none`} />
                      {fieldErrors.address && <span className="text-red-500 text-xs mt-1">{fieldErrors.address}</span>}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 uppercase">Equipment</label>
                      <input type="text" value={editFormData.equipment || ''} onChange={e => setEditFormData({...editFormData, equipment: e.target.value})} className={`w-full bg-black/50 border ${fieldErrors.equipment ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#ff4e00]'} rounded px-3 py-2 text-sm text-white focus:outline-none`} />
                      {fieldErrors.equipment && <span className="text-red-500 text-xs mt-1">{fieldErrors.equipment}</span>}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 uppercase">Price Info</label>
                      <input type="text" value={editFormData.price_info || ''} onChange={e => setEditFormData({...editFormData, price_info: e.target.value})} className={`w-full bg-black/50 border ${fieldErrors.price_info ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#ff4e00]'} rounded px-3 py-2 text-sm text-white focus:outline-none`} />
                      {fieldErrors.price_info && <span className="text-red-500 text-xs mt-1">{fieldErrors.price_info}</span>}
                    </div>
                  </>
                )}

                {activeTab === 'spots' && (
                  <>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1 uppercase">Type</label>
                      <input type="text" value={editFormData.type || ''} onChange={e => setEditFormData({...editFormData, type: e.target.value})} className={`w-full bg-black/50 border ${fieldErrors.type ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#ff4e00]'} rounded px-3 py-2 text-sm text-white focus:outline-none`} />
                      {fieldErrors.type && <span className="text-red-500 text-xs mt-1">{fieldErrors.type}</span>}
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1 uppercase">Address</label>
                      <input type="text" value={editFormData.address || ''} onChange={e => setEditFormData({...editFormData, address: e.target.value})} className={`w-full bg-black/50 border ${fieldErrors.address ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#ff4e00]'} rounded px-3 py-2 text-sm text-white focus:outline-none`} />
                      {fieldErrors.address && <span className="text-red-500 text-xs mt-1">{fieldErrors.address}</span>}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 uppercase">Business Hours</label>
                      <input type="text" value={editFormData.business_hours || ''} onChange={e => setEditFormData({...editFormData, business_hours: e.target.value})} className={`w-full bg-black/50 border ${fieldErrors.business_hours ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#ff4e00]'} rounded px-3 py-2 text-sm text-white focus:outline-none`} />
                      {fieldErrors.business_hours && <span className="text-red-500 text-xs mt-1">{fieldErrors.business_hours}</span>}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 uppercase">Social URL</label>
                      <input type="text" value={editFormData.social_url || ''} onChange={e => setEditFormData({...editFormData, social_url: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ff4e00]" />
                    </div>
                  </>
                )}

                {/* Intro */}
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1 uppercase">Intro</label>
                  <textarea value={editFormData.intro || ''} onChange={e => setEditFormData({...editFormData, intro: e.target.value})} className={`w-full bg-black/50 border ${fieldErrors.intro ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#ff4e00]'} rounded px-3 py-2 text-sm text-white focus:outline-none h-24 resize-none`} />
                  {fieldErrors.intro && <span className="text-red-500 text-xs mt-1">{fieldErrors.intro}</span>}
                </div>

                {/* Contact Info */}
                {activeTab !== 'events' && (
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1 uppercase">Contact Info</label>
                    <div className="flex gap-2">
                      <select
                        value={contactType}
                        onChange={(e) => setContactType(e.target.value as 'wechat' | 'email')}
                        className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white w-32 focus:outline-none focus:border-[#ff4e00]"
                      >
                        <option value="wechat">WeChat</option>
                        <option value="email">Email</option>
                      </select>
                      <input
                        type="text"
                        placeholder={contactType === 'wechat' ? "WeChat ID" : "Email Address"}
                        value={contactValue}
                        onChange={(e) => setContactValue(e.target.value)}
                        className="flex-1 bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ff4e00]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
              <button onClick={() => setEditingRowIndex(null)} className="px-4 py-2 rounded text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10">
                Cancel
              </button>
              <button 
                onClick={handleSaveEdit} 
                disabled={!isEditValid}
                className={`px-4 py-2 rounded text-sm font-medium text-white ${isEditValid ? 'bg-[#ff4e00] hover:bg-[#ff4e00]/90' : 'bg-gray-600 cursor-not-allowed opacity-50'}`}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

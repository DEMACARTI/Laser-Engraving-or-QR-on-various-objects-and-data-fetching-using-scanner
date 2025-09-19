
import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import './EngraveQRPage.css';

export default function EngraveQRPage() {
  const [items, setItems] = useState([]);
  const [selectedUids, setSelectedUids] = useState([]);
  const [appendUids, setAppendUids] = useState("");
  const [statusUpdate, setStatusUpdate] = useState({ uid: "", status: "", note: "" });
  const [delay, setDelay] = useState(6.0);
  const [simulate, setSimulate] = useState(true);
  const [status, setStatus] = useState({ status: 'idle' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const intervalRef = useRef(null);

  // Fetch manufactured items on mount
  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line
  }, []);

  const fetchItems = () => {
    axios.get('http://localhost:5000/items/manufactured?limit=100')
      .then(res => setItems(res.data))
      .catch(() => setError('Failed to fetch items.'));
  };

  // Poll status if engraving is running
  useEffect(() => {
    if (status.status === 'running') {
      intervalRef.current = setInterval(fetchStatus, 1200);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line
  }, [status.status]);

  const fetchStatus = async () => {
    try {
      const res = await axios.get('http://localhost:5000/engrave/status');
      setStatus(res.data);
    } catch {
      setStatus({ status: 'error' });
    }
  };

  const handleStart = async e => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const uids = (selectedUids.length > 0 ? items.filter(i => selectedUids.includes(i.uid)) : items).map(i => ({ uid: i.uid, qr_path: i.qr_path }));
      await axios.post('http://localhost:5000/engrave/start', {
        uids,
        delay_seconds: delay,
        simulate
      });
      fetchStatus();
    } catch (err) {
      setError('Failed to start engraving.');
    }
    setLoading(false);
  };

  const handleAppend = async e => {
    e.preventDefault();
    setError("");
    try {
      const uids = appendUids.split(',').map(x => x.trim()).filter(Boolean);
      if (!uids.length) return setError('Enter at least one UID to append.');
      await axios.post('http://localhost:5000/engrave/append', { uids });
      setAppendUids("");
      fetchStatus();
    } catch (err) {
      setError('Failed to append UIDs.');
    }
  };

  const handleStatusUpdate = async e => {
    e.preventDefault();
    setError("");
    try {
      if (!statusUpdate.uid || !statusUpdate.status) return setError('UID and status required.');
      await axios.post('http://localhost:5000/update_status', statusUpdate);
      setStatusUpdate({ uid: "", status: "", note: "" });
      fetchItems();
    } catch (err) {
      setError('Failed to update status.');
    }
  };

  const handlePause = async () => {
    await axios.post('http://localhost:5000/engrave/pause');
    fetchStatus();
  };
  const handleResume = async () => {
    await axios.post('http://localhost:5000/engrave/resume');
    fetchStatus();
  };
  const handleStop = async () => {
    await axios.post('http://localhost:5000/engrave/stop');
    fetchStatus();
  };

  const percent = status.total ? Math.round((status.done / status.total) * 100) : 0;

  return (
    <div className="engrave-container">
      <h1 className="engrave-title">Engrave QR Codes</h1>
      <form className="engrave-form" onSubmit={handleStart}>
        <label>
          Delay between engravings (seconds):
          <input type="number" min="1" max="30" step="0.1" value={delay} onChange={e => setDelay(e.target.value)} required />
        </label>
        <label>
          Simulate (no hardware):
          <select value={simulate ? "1" : "0"} onChange={e => setSimulate(e.target.value === "1")}> 
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={selectedUids.length === items.length} onChange={e => setSelectedUids(e.target.checked ? items.map(i=>i.uid) : [])} />
          Select all items
        </label>
        <div style={{maxHeight:120, overflowY:'auto', border:'1px solid #e0e7ff', borderRadius:8, marginBottom:8, padding:6}}>
          {items.map(i => (
            <label key={i.uid} style={{display:'block', marginBottom:4}}>
              <input type="checkbox" checked={selectedUids.includes(i.uid)} onChange={e => setSelectedUids(e.target.checked ? [...selectedUids, i.uid] : selectedUids.filter(uid=>uid!==i.uid))} />
              <b style={{marginLeft:6}}>{i.uid}</b> {i.qr_path && <span style={{color:'#64748b', fontSize:'0.97em'}}>({i.qr_path})</span>}
            </label>
          ))}
        </div>
        <button className="engrave-btn" type="submit" disabled={loading || status.status === 'running'}>
          {loading ? "Starting..." : "Start Engraving"}
        </button>
      </form>
      <form className="engrave-form" onSubmit={handleAppend} style={{marginTop:10}}>
        <label>Append UIDs to current job (comma separated):
          <input type="text" value={appendUids} onChange={e => setAppendUids(e.target.value)} placeholder="UID1, UID2, ..." />
        </label>
        <button className="engrave-btn" type="submit">Append</button>
      </form>
      <form className="engrave-form" onSubmit={handleStatusUpdate} style={{marginTop:10}}>
        <label>Update Item Status:</label>
        <input type="text" placeholder="UID" value={statusUpdate.uid} onChange={e=>setStatusUpdate({...statusUpdate, uid: e.target.value})} />
        <select value={statusUpdate.status} onChange={e=>setStatusUpdate({...statusUpdate, status: e.target.value})}>
          <option value="">Select Status</option>
          <option value="Manufactured">Manufactured</option>
          <option value="Engraved">Engraved</option>
          <option value="Shipped">Shipped</option>
          <option value="Rejected">Rejected</option>
        </select>
        <input type="text" placeholder="Note (optional)" value={statusUpdate.note} onChange={e=>setStatusUpdate({...statusUpdate, note: e.target.value})} />
        <button className="engrave-btn" type="submit">Update Status</button>
      </form>
      {error && <div className="engrave-status" style={{ color: '#dc2626', background: '#fef2f2' }}>{error}</div>}
      {status.status !== 'idle' && (
        <div className="engrave-status">
          <div>Status: <b>{status.status}</b></div>
          {status.status === 'running' && (
            <>
              <div>Progress: {status.done} / {status.total}</div>
              <div className="engrave-progress-bar">
                <div className="engrave-progress" style={{ width: percent + '%' }} />
              </div>
              <div style={{ marginTop: 10 }}>
                <button className="engrave-btn" style={{marginRight:8}} onClick={handlePause} disabled={status.status !== 'running'}>Pause</button>
                <button className="engrave-btn" onClick={handleStop} disabled={status.status !== 'running'}>Stop</button>
              </div>
            </>
          )}
          {status.status === 'paused' && (
            <button className="engrave-btn" onClick={handleResume}>Resume</button>
          )}
        </div>
      )}
      <div style={{marginTop:30, width:'100%'}}>
        <h3 style={{textAlign:'center', color:'#2563eb', marginBottom:8}}>Items to Engrave</h3>
        <ul style={{maxHeight:180, overflowY:'auto', padding:0, margin:0, listStyle:'none'}}>
          {items.map(i => (
            <li key={i.uid} style={{marginBottom:6, padding: '4px 0', borderBottom:'1px solid #e0e7ff'}}>
              <b>{i.uid}</b> {i.qr_path && <span style={{color:'#64748b', fontSize:'0.97em'}}>({i.qr_path})</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

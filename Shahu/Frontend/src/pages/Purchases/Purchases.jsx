import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { apiClient } from '../../api/axios';
import { FiX } from 'react-icons/fi';

export function Purchases() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [credentials, setCredentials] = useState(null);
  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/course-purchases', { params: { status } });
      setItems(response.data.data || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [status]);
  const verify = async (item, nextStatus) => {
    const reason = window.prompt(
      nextStatus === 'successful' ? 'Verification reason/reference' : 'Failure reason'
    );
    if (!reason) return;
    setWorking(item._id);
    try {
      const response = await apiClient.patch(`/course-purchases/transactions/${item._id}/verify`, {
        status: nextStatus,
        reason,
        gatewayReference: nextStatus === 'successful' ? item.transactionReference : undefined,
      });
      if (response.data.data?.temporaryPassword) {
        setCredentials({
          email: response.data.data.student?.email,
          temporaryPassword: response.data.data.temporaryPassword,
        });
      }
      toast.success(
        nextStatus === 'successful'
          ? 'Payment verified and student enrolled'
          : 'Payment marked failed'
      );
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to verify transaction');
    } finally {
      setWorking('');
    }
  };
  return (
    <section className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PAYMENT OPERATIONS</p>
          <h1>Course purchases</h1>
          <p>
            Android submissions remain pending until an authorized server-side verification
            decision.
          </p>
        </div>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="successful">Successful</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      <div className="purchase-operation-list">
        {loading ? (
          <div className="card student-empty">Loading transactions…</div>
        ) : (
          items.map((item) => (
            <article className="purchase-operation-card" key={item._id}>
              <div>
                <h3>{item.course?.name}</h3>
                <span className={`status-pill ${item.status}`}>{item.status}</span>
              </div>
              <p>
                <b>{item.buyer?.name}</b> · {item.buyer?.mobileNo} · {item.buyer?.email}
              </p>
              <p>
                Purchase ID: <b>{item.purchaseId || 'Legacy pending migration'}</b> · Transaction:{' '}
                {item.transactionReference} · {item.paymentMethod}
              </p>
              {item.receiptNumber ? (
                <p>
                  Receipt: {item.receiptNumber}
                  {item.receiptEmailedAt ? ' · emailed' : ''}
                </p>
              ) : null}
              <p>
                Payable: ₹{Number(item.pricing?.payablePrice || 0).toLocaleString('en-IN')} ·
                Submitted {new Date(item.createdAt).toLocaleString('en-IN')}
              </p>
              {item.status === 'pending' && (
                <div className="purchase-actions">
                  <button
                    disabled={working === item._id}
                    onClick={() => verify(item, 'successful')}
                  >
                    Verify success
                  </button>
                  <button
                    disabled={working === item._id}
                    className="danger"
                    onClick={() => verify(item, 'failed')}
                  >
                    Mark failed
                  </button>
                </div>
              )}
            </article>
          ))
        )}
      </div>
      {credentials && (
        <div className="login-overlay">
          <article className="student-form credential-panel">
            <button className="modal-close" onClick={() => setCredentials(null)}>
              <FiX />
            </button>
            <p className="eyebrow">NEW STUDENT LOGIN</p>
            <h2>Payment verified</h2>
            <p>The student account was created. Share this one-time password securely.</p>
            <dl>
              <div>
                <dt>Email</dt>
                <dd>{credentials.email}</dd>
              </div>
              <div>
                <dt>Temporary password</dt>
                <dd className="temporary-password">{credentials.temporaryPassword}</dd>
              </div>
            </dl>
            <button className="btn btn-primary" onClick={() => setCredentials(null)}>
              I have saved it securely
            </button>
          </article>
        </div>
      )}
    </section>
  );
}

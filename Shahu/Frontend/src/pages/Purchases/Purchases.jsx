import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { apiClient } from '../../api/axios';
import { useSelector } from 'react-redux';
import { FiEye, FiEyeOff, FiKey, FiMail, FiPlus, FiX } from 'react-icons/fi';

const emptyManualPurchase = {
  courseId: '', name: '', email: '', age: '', education: '', address: '', mobileNo: '',
  transactionId: '', paymentMethod: 'gpay', paymentDate: new Date().toISOString().slice(0, 10), note: '',
};

export function Purchases() {
  const user = useSelector((state) => state.auth.user);
  const [items, setItems] = useState([]);
  const [manualPayments, setManualPayments] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [credentials, setCredentials] = useState(null);
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState(emptyManualPurchase);
  const [courses, setCourses] = useState([]);
  const load = async () => {
    setLoading(true);
    try {
      const [response, manualResponse] = await Promise.all([
        apiClient.get('/course-purchases', { params: { status } }),
        apiClient.get('/admin/payments', { params: { status: status === 'pending' ? 'PENDING_VERIFICATION' : undefined } }),
      ]);
      setItems(response.data.data || []);
      setManualPayments(manualResponse.data.data || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [status]);
  useEffect(() => {
    if (user?.role !== 'superadmin') return;
    apiClient.get('/courses', { params: { limit: 100, status: 'active' } })
      .then((response) => setCourses(response.data.data || []))
      .catch(() => setCourses([]));
  }, [user?.role]);
  const submitManualPurchase = async (event) => {
    event.preventDefault();
    try {
      await apiClient.post('/course-purchases/manual', manualForm, {
        headers: { 'X-Client-Platform': 'laptop' },
      });
      toast.success('Manual payment submitted. Verify it to create the student account.');
      setManualForm(emptyManualPurchase);
      setManualOpen(false);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to submit manual payment');
    }
  };
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
          studentId: response.data.data.student?._id,
          email: response.data.data.student?.email,
          temporaryPassword: response.data.data.temporaryPassword,
        });
        setShowTemporaryPassword(false);
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
  const reconcileRazorpayPayment = async (item) => {
    setWorking(item._id);
    try {
      const response = await apiClient.post(`/admin/payments/${item._id}/reconcile`);
      toast.success(response.data.message || 'Razorpay payment status checked');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to check this payment with Razorpay');
    } finally { setWorking(''); }
  };
  const issueTemporaryPassword = async (item) => {
    const studentId = item.student?._id || item.student;
    if (!studentId) return toast.error('This transaction is not linked to a student account yet.');
    const reason = window.prompt('Reason for issuing a new temporary password');
    if (!reason) return;
    setWorking(item._id);
    try {
      const response = await apiClient.post(`/course-purchases/students/${studentId}/reset-password`, { reason });
      setCredentials(response.data.data);
      setShowTemporaryPassword(false);
      toast.success('New temporary password issued. It can now be shown or emailed once.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to issue temporary password');
    } finally { setWorking(''); }
  };
  const emailTemporaryPassword = async () => {
    if (!credentials?.studentId || !credentials?.temporaryPassword) return;
    const reason = window.prompt('Reason for emailing this temporary password', 'Student requested login credentials');
    if (!reason) return;
    try {
      await apiClient.post(`/course-purchases/students/${credentials.studentId}/email-temporary-password`, {
        temporaryPassword: credentials.temporaryPassword,
        reason,
      });
      toast.success(`Temporary password emailed to ${credentials.email}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to email temporary password');
    }
  };
  const verifyManualPayment = async (item, action) => {
    const approved = action === 'approve';
    const message = approved
      ? 'Confirm that this payment is visible in the receiving bank or UPI account before approving.'
      : 'Enter the reason for rejecting this payment.';
    const reason = window.prompt(message, approved ? 'Payment visible in receiving account' : 'Payment not found in receiving account');
    if (!reason) return;
    setWorking(item._id);
    try {
      await apiClient.post(`/admin/payments/${item._id}/${action}`, approved ? {} : { reason });
      toast.success(approved ? 'Payment approved and course access activated.' : 'Payment rejected.');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update payment');
    } finally { setWorking(''); }
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
        {user?.role === 'superadmin' ? <button className="btn btn-primary" onClick={() => setManualOpen(true)}><FiPlus /> Add manual payment</button> : null}
      </div>
      <div className="purchase-operation-list">
        <h2>Payment history</h2>
        {manualPayments.length ? manualPayments.map((item) => (
          <article className="purchase-operation-card" key={item._id}>
            <div><h3>{item.course?.name || 'Course'}</h3><span className={`status-pill ${String(item.status).toLowerCase()}`}>{item.status}</span></div>
            <p><b>{item.buyer?.name || 'Buyer'}</b> · {item.email} · {item.buyer?.mobileNo || 'No mobile number'}</p>
            <p>Amount: <b>₹{Number(item.amount || 0).toFixed(2)}</b> · Provider: <b>{item.provider || 'upi'}</b> · Status: <b>{item.status}</b> · Reference: {item.transactionReference}</p>
            <p>UTR: <b>{item.utrNumber || 'Not submitted'}</b> · App: {item.paymentApp || '—'} · Submitted: {item.submittedAt ? new Date(item.submittedAt).toLocaleString('en-IN') : '—'}</p>
            {item.paymentScreenshotUrl ? <p><a href={item.paymentScreenshotUrl} target="_blank" rel="noreferrer">Open screenshot</a></p> : null}
            <div className="purchase-actions">
              {item.provider === 'razorpay' ? <button disabled={working === item._id} onClick={() => reconcileRazorpayPayment(item)}>Check Razorpay status</button> : null}
              {item.status === 'PENDING_VERIFICATION' ? <><button disabled={working === item._id} onClick={() => verifyManualPayment(item, 'approve')}>Approve</button><button disabled={working === item._id} className="danger" onClick={() => verifyManualPayment(item, 'reject')}>Reject</button><button onClick={() => navigator.clipboard?.writeText(item.utrNumber || '')}>Copy UTR</button></> : null}
            </div>
          </article>
        )) : <div className="card student-empty">No manual UPI payments need verification.</div>}
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
                {item.transactionReference} · {item.paymentMethod} · {item.submittedFrom || 'android'}
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
              {item.status === 'successful' && item.student ? (
                <div className="purchase-actions">
                  <button disabled={working === item._id} onClick={() => issueTemporaryPassword(item)}><FiKey /> Issue temporary password</button>
                </div>
              ) : null}
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
                <dt>Latest temporary password</dt>
                <dd className="temporary-password">{showTemporaryPassword ? credentials.temporaryPassword : '••••••••••••'}</dd>
              </div>
            </dl>
            <div className="purchase-actions">
              <button type="button" onClick={() => setShowTemporaryPassword((value) => !value)}>{showTemporaryPassword ? <FiEyeOff /> : <FiEye />} {showTemporaryPassword ? 'Hide password' : 'Show password'}</button>
              <button type="button" onClick={emailTemporaryPassword}><FiMail /> Email temporary password</button>
              <button className="btn btn-primary" onClick={() => setCredentials(null)}>I have saved it securely</button>
            </div>
          </article>
        </div>
      )}
      {manualOpen ? (
        <div className="login-overlay" onMouseDown={() => setManualOpen(false)}>
          <form className="student-form manual-payment-form" onMouseDown={(event) => event.stopPropagation()} onSubmit={submitManualPurchase}>
            <button className="modal-close" onClick={() => setManualOpen(false)} type="button"><FiX /></button>
            <p className="eyebrow">SUPERADMIN ONLY</p>
            <h2>Add laptop payment</h2>
            <p>Submit the payment first. The student account is created only after you verify it as successful.</p>
            <select required value={manualForm.courseId} onChange={(event) => setManualForm((value) => ({ ...value, courseId: event.target.value }))}><option value="">Select course</option>{courses.map((course) => <option key={course._id} value={course._id}>{course.name}</option>)}</select>
            <div className="student-fields"><input placeholder="Student full name" required value={manualForm.name} onChange={(event) => setManualForm((value) => ({ ...value, name: event.target.value }))} /><input placeholder="Student email" required type="email" value={manualForm.email} onChange={(event) => setManualForm((value) => ({ ...value, email: event.target.value }))} /><input placeholder="Mobile number" required value={manualForm.mobileNo} onChange={(event) => setManualForm((value) => ({ ...value, mobileNo: event.target.value }))} /><input min="1" placeholder="Age" required type="number" value={manualForm.age} onChange={(event) => setManualForm((value) => ({ ...value, age: event.target.value }))} /><input placeholder="Education" required value={manualForm.education} onChange={(event) => setManualForm((value) => ({ ...value, education: event.target.value }))} /><input placeholder="Transaction / UTR ID" required value={manualForm.transactionId} onChange={(event) => setManualForm((value) => ({ ...value, transactionId: event.target.value }))} /><select required value={manualForm.paymentMethod} onChange={(event) => setManualForm((value) => ({ ...value, paymentMethod: event.target.value }))}><option value="gpay">GPay</option><option value="phonepe">PhonePe</option><option value="paytm">Paytm</option><option value="bank-transfer">Bank transfer</option><option value="cash">Cash</option><option value="other">Other</option></select><input required type="date" value={manualForm.paymentDate} onChange={(event) => setManualForm((value) => ({ ...value, paymentDate: event.target.value }))} /></div>
            <textarea placeholder="Address" required value={manualForm.address} onChange={(event) => setManualForm((value) => ({ ...value, address: event.target.value }))} />
            <textarea placeholder="Message / payment note" value={manualForm.note} onChange={(event) => setManualForm((value) => ({ ...value, note: event.target.value }))} />
            <button className="btn btn-primary">Submit manual payment</button>
          </form>
        </div>
      ) : null}
    </section>
  );
}

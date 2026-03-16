import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const looksLikeReferralCode = (value: string) => /^[A-Z0-9]{2,10}-\d{3,12}$/i.test(value);

export default function ReferralCodeRedirectPage() {
  const navigate = useNavigate();
  const params = useParams();

  useEffect(() => {
    const referralCode = String(params.referralCode || '').trim().toUpperCase();
    if (!looksLikeReferralCode(referralCode)) {
      navigate('/', { replace: true });
      return;
    }
    navigate(`/register?ref=${encodeURIComponent(referralCode)}`, { replace: true });
  }, [navigate, params.referralCode]);

  return null;
}

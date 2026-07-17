import { useTranslation } from 'react-i18next';

export function EmptyState({ message }) {
  const { t } = useTranslation();
  return <div className="empty-state">{message || t('empty')}</div>;
}

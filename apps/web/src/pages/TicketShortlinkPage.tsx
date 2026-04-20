import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

/**
 * `/t/:ticketId` is the canonical, shareable URL for a ticket.
 * It simply redirects to /tasks?open=<id>, which is where the board lives
 * and which knows how to auto-open the modal.
 */
export function TicketShortlinkPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (ticketId) {
      navigate(`/tasks?open=${encodeURIComponent(ticketId)}`, { replace: true });
    } else {
      navigate('/tasks', { replace: true });
    }
  }, [ticketId, navigate]);

  return null;
}

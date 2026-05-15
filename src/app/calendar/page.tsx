import { PageHeader } from "@/components/page-header";
import { CalendarDayView } from "@/components/calendar-day-view";
import { getCalendarEvents } from "@/lib/mock/calendar-events";

export default function CalendarPage() {
  const events = getCalendarEvents();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="shrink-0">
        <PageHeader title="Calendar" />
      </div>
      <CalendarDayView initialEvents={events} />
    </div>
  );
}

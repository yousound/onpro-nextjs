import { PageHeader } from "@/components/page-header";
import { CalendarDayView } from "@/components/calendar-day-view";
import { getCalendarEvents } from "@/lib/mock/calendar-events";

export default function CalendarPage() {
  const events = getCalendarEvents();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="shrink-0">
        <PageHeader
          title="Calendar"
          subtitle="Operations day view: lanes by department and logistics. Add event mocks persist in this browser (localStorage). Seed data is iOS-aligned."
        />
      </div>
      <CalendarDayView initialEvents={events} />
    </div>
  );
}

import { useEffect } from "react";
import { useRoute } from "./lib/router";
import { useSession } from "./lib/store";
import { Shell } from "./components/Shell";
import { Toaster, EmptyState } from "./components/ui";
import { HomePage } from "./pages/Home";
import { CoursePage } from "./pages/Course";
import { AssignmentPage } from "./pages/Assignment";
import { ExamPage, ExamsPage } from "./pages/Exam";
import { AuditPage, BrandPage, CoursesPage, PeoplePage, PrivacyPage, ResultsPage, RosterPage } from "./pages/Admin";
import { Lock } from "lucide-react";
import type { Role } from "./lib/types";

// Which roles may open each screen. Anything else shows a clear "not for you" message.
const ACCESS: Record<string, Role[]> = {
  results: ["student"],
  roster: ["admin"], people: ["admin"], audit: ["admin"], brand: ["admin"],
};

const TITLES: Record<string, string> = {
  home: "Home", courses: "Courses", course: "Course", assignment: "Assignment", exams: "Exams", exam: "Exam",
  results: "Results", roster: "Roster import", people: "People", privacy: "Data & privacy", audit: "Audit log", brand: "Branding",
};

export default function App() {
  const route = useRoute();
  const session = useSession();
  useEffect(() => { document.title = `${TITLES[route.name]} · Mandovi`; }, [route.name]);

  const allowed = !ACCESS[route.name] || ACCESS[route.name].includes(session.role);
  let page;
  if (!allowed) page = <EmptyState icon={Lock} title="This page isn't available to your account">It's for {ACCESS[route.name].join(" or ")} accounts. <a href="#home" className="text-primary-text underline">Go to your home page</a></EmptyState>;
  else switch (route.name) {
    case "home": page = <HomePage />; break;
    case "courses": page = <CoursesPage />; break;
    case "course": page = <CoursePage id={route.id} tab={route.tab} />; break;
    case "assignment": page = <AssignmentPage id={route.id} />; break;
    case "exams": page = <ExamsPage />; break;
    case "exam": page = <ExamPage id={route.id} />; break;
    case "results": page = <ResultsPage />; break;
    case "roster": page = <RosterPage />; break;
    case "people": page = <PeoplePage />; break;
    case "privacy": page = <PrivacyPage />; break;
    case "audit": page = <AuditPage />; break;
    case "brand": page = <BrandPage />; break;
  }
  return (
    <>
      <Shell route={route}>{page}</Shell>
      <Toaster />
    </>
  );
}

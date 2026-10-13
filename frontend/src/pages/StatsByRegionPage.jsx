import Stats from "../StatsByRegion/Stats.jsx";
import Header from "../Header.jsx";
import Chatbot from "../Chatbot/Chatbot.jsx";


function StatsByRegionPage() {
  return (
    <>
      <Header />
      <Stats/>
      <Chatbot pageContext={{ page: "Overview (regional price statistics)" }} />
    </>
  );
}

export default StatsByRegionPage;


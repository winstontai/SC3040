
import * as ReactDOM from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";

import DynamicMap from "./DynamicMap.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import TutorialPage from "./pages/TutorialPage.jsx";
import StatsByRegionPage from "./pages/StatsByRegionPage.jsx";
import HDBProvider from "./HDBProvider.jsx";  


const HDBLayout = ({ children }) => (
  <HDBProvider>
    {children}
  </HDBProvider>
);


/**
 * Sets up client-side routing for the application with route definitions
 * for the landing page, dynamic map, and tutorial page.
 */
const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <HDBLayout>
        <LandingPage />
      </HDBLayout>
    ),
    errorElement: <NotFoundPage />,
  },
  {
    path: '/map',
    element: (
      <HDBLayout>
        <DynamicMap />
      </HDBLayout>
    ),
  },
  {
    path: '/tutorial',
    element: <TutorialPage />,
  },
  {
    path: '/overview',
    element: <StatsByRegionPage />,
  },
]);

/**
 * Wraps the application in HDBProvider to supply global context
 * for filtered HDB data across all routes.
 * 
 * @author Jia Yang
 */

ReactDOM.createRoot(document.getElementById("root")).render(
  <RouterProvider router={router} />
);


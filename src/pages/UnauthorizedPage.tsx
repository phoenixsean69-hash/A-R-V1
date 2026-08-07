import {
  ArrowLeft,
  ShieldX,
} from "../components/icons/materialIcons";
import { Link } from "react-router-dom";

export default function UnauthorizedPage() {
  return (
    <div className="grid min-h-[calc(100vh-68px)] place-items-center p-5">
      <section className="ui-panel w-full max-w-lg overflow-hidden text-center">
        <div className="border-b border-[#494949] p-6">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-md border border-[#713646] bg-[#321722] text-[#e28b9d]">
            <ShieldX size={22} />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-100">
            Client access restricted
          </h1>
          <p className="mt-3 text-[10px] leading-5 text-slate-500">
            Your station membership is valid, but your role
            cannot open this RoadSafe workspace.
          </p>
        </div>

        <div className="p-5">
          <Link to="/" className="ui-button">
            <ArrowLeft size={14} />
            Return to my client
          </Link>
        </div>
      </section>
    </div>
  );
}

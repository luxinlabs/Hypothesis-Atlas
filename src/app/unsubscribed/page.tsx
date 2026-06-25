import Link from "next/link";

interface Props {
  searchParams: { topic?: string; email?: string; status?: string };
}

export default function UnsubscribedPage({ searchParams }: Props) {
  const { topic, email, status } = searchParams;

  const isError   = status === "error";
  const isInvalid = status === "invalid" || status === "notfound";
  const isSuccess = !isError && !isInvalid && !!topic;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #ddd6fe 100%)" }}
    >
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-10 max-w-md w-full text-center">
        {isSuccess ? (
          <>
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: "linear-gradient(135deg, #4f46e5, #9333ea)" }}
            >
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">You&apos;ve been unsubscribed</h1>
            <p className="text-gray-500 text-sm mb-5">
              {email && <><span className="font-semibold text-gray-700">{email}</span> will no longer receive</>}
              {!email && "You'll no longer receive"} weekly paper digests on{" "}
              <span className="font-semibold text-indigo-600">{topic}</span>.
            </p>
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-4 mb-6 text-left">
              <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wide mb-1">Unsubscribed from</p>
              <p className="text-sm font-semibold text-gray-800">{topic}</p>
            </div>
            <p className="text-xs text-gray-400 mb-6">
              Changed your mind? You can re-subscribe anytime from the Hypothesis Atlas app.
            </p>
          </>
        ) : isInvalid ? (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Link not found</h1>
            <p className="text-gray-500 text-sm mb-6">
              This unsubscribe link is invalid or has already been used. You may already be unsubscribed.
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-gray-500 text-sm mb-6">
              We couldn&apos;t process your unsubscribe request. Please try again or contact support.
            </p>
          </>
        )}

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-white px-6 py-2.5 rounded-xl"
          style={{ background: "linear-gradient(to right, #4f46e5, #9333ea)" }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Hypothesis Atlas
        </Link>
      </div>
    </div>
  );
}

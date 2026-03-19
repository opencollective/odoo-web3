import { fetchHostedCollectives } from "../services/opencollective.js";
import { LoaderIcon } from "./icons.jsx";

const { useState, useEffect } = React;

export function CollectivesPage({ navigate }) {
  const [collectives, setCollectives] = useState([]);
  const [host, setHost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadCollectives();
  }, []);

  const loadCollectives = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchHostedCollectives({
        hostSlug: "citizenspring-asbl",
        limit: 100,
        offset: 0,
      });

      setHost(result.host);
      setCollectives(result.collectives);
      setTotalCount(result.totalCount);
    } catch (err) {
      console.error("Failed to fetch collectives:", err);
      setError(err.message || "Failed to fetch collectives");
      setCollectives([]);
    } finally {
      setLoading(false);
    }
  };

  const formatBalance = (stats) => {
    if (!stats?.balance) return "N/A";
    const { valueInCents, currency } = stats.balance;
    const amount = valueInCents / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate("/")}
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              &larr; Back to Home
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {host?.name || "Hosted Collectives"}
              </h1>
              {host?.description && (
                <p className="text-gray-600 mt-1">{host.description}</p>
              )}
              <p className="text-gray-500 mt-2">
                {totalCount} collective{totalCount !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadCollectives}
                disabled={loading}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <LoaderIcon />
          </div>
        )}

        {/* Collectives Grid */}
        {!loading && collectives.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collectives.map((collective) => (
              <button
                key={collective.id}
                onClick={() => navigate(`/oc/${collective.slug}`)}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow text-left group"
              >
                <div className="flex items-start gap-4 mb-4">
                  {collective.imageUrl ? (
                    <img
                      src={collective.imageUrl}
                      alt={collective.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-semibold">
                      {collective.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg text-gray-900 truncate group-hover:text-purple-600 transition-colors">
                      {collective.name}
                    </h3>
                    <p className="text-sm text-gray-500">@{collective.slug}</p>
                  </div>
                </div>

                {collective.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {collective.description}
                  </p>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Balance
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatBalance(collective.stats)}
                    </p>
                  </div>
                  {collective.isActive ? (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      Inactive
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-center text-purple-600 text-sm font-medium">
                  View Expenses
                  <svg
                    className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && collectives.length === 0 && !error && (
          <div className="text-center py-12">
            <p className="text-gray-500">No collectives found.</p>
          </div>
        )}
      </div>
    </div>
  );
}

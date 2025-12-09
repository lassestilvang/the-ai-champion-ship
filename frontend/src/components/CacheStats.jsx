import React from 'react';

export default function CacheStats({ stats }) {
  if (!stats) return null;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mt-8">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        📊 Cache & App Statistics
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Notes" value={stats.totalNotes} />
        <StatCard title="Cache Hits" value={stats.cache.hits} />
        <StatCard title="Cache Misses" value={stats.cache.misses} />
        <StatCard title="Cache Hit Rate" value={stats.cache.hitRate} />
        <StatCard title="Cached Items" value={stats.cache.cacheSize} />
        <StatCard title="Memory Usage" value={stats.cache.memoryUsage} />
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="bg-blue-50 p-4 rounded-lg shadow-sm">
      <p className="text-sm font-medium text-blue-700">{title}</p>
      <p className="text-2xl font-bold text-blue-900 mt-1">{value}</p>
    </div>
  );
}

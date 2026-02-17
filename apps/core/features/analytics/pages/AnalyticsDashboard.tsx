/**
 * Analytics Dashboard
 * Week 2-3 User Behavior Tracking Visualization
 */

import { useState, useEffect } from 'react';
import { getUserMetrics, getDailyMetrics, getFeatureAdoption, getRealtimeMetrics } from '../api/analytics.api';
import type { UserMetrics, DailyMetrics, FeatureAdoption, RealtimeMetrics } from '../api/analytics.api';

export function AnalyticsDashboard() {
  const [userMetrics, setUserMetrics] = useState<UserMetrics | null>(null);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetrics[]>([]);
  const [featureAdoption, setFeatureAdoption] = useState<FeatureAdoption[]>([]);
  const [realtimeMetrics, setRealtimeMetrics] = useState<RealtimeMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();

    // Refresh realtime metrics every 30 seconds
    const interval = setInterval(() => {
      getRealtimeMetrics().then(setRealtimeMetrics).catch(console.error);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  async function loadMetrics() {
    try {
      setLoading(true);

      // Get last 7 days of data
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [users, daily, features, realtime] = await Promise.all([
        getUserMetrics(),
        getDailyMetrics(startDate, endDate),
        getFeatureAdoption(startDate, endDate),
        getRealtimeMetrics()
      ]);

      setUserMetrics(users);
      setDailyMetrics(daily);
      setFeatureAdoption(features);
      setRealtimeMetrics(realtime);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Analytics Dashboard</h1>

      {/* Realtime Metrics */}
      {realtimeMetrics && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-3">Realtime Activity</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">Active Users Now</div>
              <div className="text-2xl font-bold">{realtimeMetrics.active_users_now}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Events (Last 5min)</div>
              <div className="text-2xl font-bold">{realtimeMetrics.events_last_5_min}</div>
            </div>
          </div>
        </div>
      )}

      {/* User Metrics */}
      {userMetrics && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">User Metrics</h2>
          <div className="grid grid-cols-4 gap-4">
            <MetricCard title="Daily Active Users" value={userMetrics.daily_active_users} />
            <MetricCard title="Weekly Active Users" value={userMetrics.weekly_active_users} />
            <MetricCard title="Monthly Active Users" value={userMetrics.monthly_active_users} />
            <MetricCard title="New Users Today" value={userMetrics.new_users_today} />
          </div>
        </div>
      )}

      {/* Daily Metrics Trend */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">7-Day Trend</h2>
        {dailyMetrics.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Date</th>
                  <th className="text-right p-2">Active Users</th>
                  <th className="text-right p-2">Sessions</th>
                  <th className="text-right p-2">Page Views</th>
                  <th className="text-right p-2">Avg Session (min)</th>
                  <th className="text-right p-2">Engagement Score</th>
                </tr>
              </thead>
              <tbody>
                {dailyMetrics.map((day) => (
                  <tr key={day.date} className="border-b hover:bg-gray-50">
                    <td className="p-2">{day.date}</td>
                    <td className="text-right p-2">{day.active_users}</td>
                    <td className="text-right p-2">{day.total_sessions}</td>
                    <td className="text-right p-2">{day.total_page_views}</td>
                    <td className="text-right p-2">
                      {(day.avg_session_duration_seconds / 60).toFixed(1)}
                    </td>
                    <td className="text-right p-2">
                      <span className={`px-2 py-1 rounded ${getScoreColor(day.engagement_score)}`}>
                        {day.engagement_score.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-gray-500">No data available</div>
        )}
      </div>

      {/* Feature Adoption */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Feature Adoption</h2>
        {featureAdoption.length > 0 ? (
          <div className="space-y-3">
            {featureAdoption.slice(0, 10).map((feature) => (
              <div key={feature.feature_name} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium">{feature.feature_name}</div>
                  <div className="text-sm text-gray-600">
                    {feature.unique_users} users • {feature.usage_count} uses
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold">{feature.adoption_rate.toFixed(1)}%</div>
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${Math.min(100, feature.adoption_rate)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500">No feature data available</div>
        )}
      </div>

      {/* Top Pages (Realtime) */}
      {realtimeMetrics && realtimeMetrics.top_pages.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Top Pages (Last Hour)</h2>
          <div className="space-y-2">
            {realtimeMetrics.top_pages.map((page, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span className="font-mono text-sm">{page.path}</span>
                <span className="font-semibold">{page.views} views</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="text-sm text-gray-600 mb-1">{title}</div>
      <div className="text-3xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'bg-green-100 text-green-800';
  if (score >= 40) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

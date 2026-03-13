import { Clock, User, ShoppingBag, Package, CheckCircle, AlertCircle } from 'lucide-react';

interface Activity {
  id: string;
  type: 'order' | 'shipping' | 'user' | 'product' | 'review' | 'inventory' | 'system';
  title: string;
  description: string;
  timestamp: string;
  user?: {
    name: string;
    avatar?: string;
  };
}

interface ActivityFeedProps {
  activities: Activity[];
  title?: string;
  maxItems?: number;
}

const typeConfig = {
  order: { icon: ShoppingBag, color: 'bg-blue-100 text-blue-600' },
  shipping: { icon: Package, color: 'bg-indigo-100 text-indigo-600' },
  user: { icon: User, color: 'bg-green-100 text-green-600' },
  product: { icon: Package, color: 'bg-purple-100 text-purple-600' },
  review: { icon: CheckCircle, color: 'bg-amber-100 text-amber-600' },
  inventory: { icon: Package, color: 'bg-orange-100 text-orange-600' },
  system: { icon: AlertCircle, color: 'bg-gray-100 text-gray-600' },
};

function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default function ActivityFeed({ activities, title = 'Recent Activity', maxItems = 5 }: ActivityFeedProps) {
  const displayActivities = activities.slice(0, maxItems);
  
  return (
    <div className="bg-white rounded-xl shadow-sm border">
      <div className="p-6 border-b">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="p-4">
        <div className="space-y-4">
          {displayActivities.map((activity) => {
            const config = typeConfig[activity.type] || typeConfig.system;
            const Icon = config.icon;
            
            return (
              <div key={activity.id} className="flex items-start gap-4">
                <div className={`w-10 h-10 ${config.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{activity.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-400">{formatTimeAgo(activity.timestamp)}</span>
                    {activity.user && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-gray-500">by {activity.user.name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {activities.length === 0 && (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No recent activity</p>
          </div>
        )}
      </div>
    </div>
  );
}

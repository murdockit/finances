import { Bar, Doughnut } from "react-chartjs-2";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  PointElement,
  Tooltip,
  LineElement,
} from "chart.js";
import { groupByCategory, groupByMonth } from "../lib/aggregate";
import { Transaction } from "../lib/types";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

const COLORS = [
  "#0f4c81",
  "#f07f2e",
  "#1f9d55",
  "#e63946",
  "#6d597a",
  "#2a9d8f",
  "#e9c46a",
  "#264653",
];

type ChartsProps = {
  transactions: Transaction[];
};

export function Charts({ transactions }: ChartsProps) {
  const byCategory = groupByCategory(transactions);
  const categoryLabels = Array.from(byCategory.keys());
  const categoryValues = Array.from(byCategory.values());

  const byMonth = groupByMonth(transactions);
  const monthLabels = Array.from(byMonth.keys()).sort();
  const monthValues = monthLabels.map((label) => byMonth.get(label) ?? 0);

  const categoryData = {
    labels: categoryLabels,
    datasets: [
      {
        label: "Spending",
        data: categoryValues,
        backgroundColor: categoryLabels.map(
          (_, index) => COLORS[index % COLORS.length]
        ),
      },
    ],
  };

  const monthData = {
    labels: monthLabels,
    datasets: [
      {
        label: "Monthly Spending",
        data: monthValues,
        backgroundColor: "#0f4c81",
      },
    ],
  };

  return (
    <div className="charts">
      <div className="chart-card">
        <h3>Spending by Category</h3>
        {categoryLabels.length === 0 ? (
          <p className="muted">No expense data yet.</p>
        ) : (
          <Doughnut data={categoryData} />
        )}
      </div>
      <div className="chart-card">
        <h3>Monthly Spending</h3>
        {monthLabels.length === 0 ? (
          <p className="muted">No expense data yet.</p>
        ) : (
          <Bar data={monthData} />
        )}
      </div>
    </div>
  );
}

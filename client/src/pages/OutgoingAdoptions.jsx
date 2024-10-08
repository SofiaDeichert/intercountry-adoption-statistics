import { useState, useEffect } from 'react';
import { fetchOutgoingAdoptions, fetchYears } from '../services/api';
import YearFilter from '../components/YearFilter';
import OutgoingDataTable from '../components/OutgoingDataTable';
import CustomBarChart from '../components/CustomBarChart';

const OutgoingAdoptions = () => {
  const [data, setData] = useState([]);
  const [selectedYear, setSelectedYear] = useState('all');
  const [years, setYears] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCases, setTotalCases] = useState(0);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const yearsResult = await fetchYears();
        setYears(['all', ...yearsResult.data]);
        const adoptionsResult = await fetchOutgoingAdoptions('all');
        setData(adoptionsResult.data);
        setTotalCases(adoptionsResult.total_cases);
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const result = await fetchOutgoingAdoptions(selectedYear);
        setData(result.data);
        setTotalCases(result.total_cases);
      } catch (error) {
        console.error('Error fetching outgoing adoptions:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [selectedYear]);

  const handleYearChange = (year) => {
    setSelectedYear(year);
  };

  const columns = [
    { key: 'receiving_country', header: 'Receiving Country' },
    { key: 'total_cases', header: 'Total Cases' },
  ];

  // Data for receiving countries chart
  const receivingCountriesChartData = data
    .sort((a, b) => b.total_cases - a.total_cases)
    .slice(0, 10);

  // Data for U.S. states chart
  const usStatesChartData = data
    .reduce((acc, country) => {
      Object.entries(country.us_states).forEach(([state, cases]) => {
        const existingState = acc.find((item) => item.state === state);
        if (existingState) {
          existingState.total_cases += cases;
        } else {
          acc.push({ state, total_cases: cases });
        }
      });
      return acc;
    }, [])
    .sort((a, b) => b.total_cases - a.total_cases)
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-gradient-to-b  pt-16">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-center mb-12 text-blue-800 leading-tight">
          Outgoing Adoptions
        </h1>
        <div className="flex justify-center mb-12">
          <div className="w-full md:w-64">
            <YearFilter
              years={years}
              selectedYear={selectedYear}
              onYearChange={handleYearChange}
            />
          </div>
        </div>
        {isLoading ? (
          <div className="text-center text-2xl font-semibold text-blue-600">
            Loading...
          </div>
        ) : (
          <>
            <div className="mt-8">
              <h3 className="text-center text-3xl font-bold mb-12 text-blue-800">
                Total Cases: {totalCases}
              </h3>
              <div className="xl:px-16 2xl:px-24 3xl:px-36 4xl:px-48 5xl:px-84">
                <OutgoingDataTable data={data} columns={columns} />
              </div>
            </div>
            <div className="mt-16 space-y-16">
              <div className="w-full xl:px-16 2xl:px-24 3xl:px-36 4xl:px-48 5xl:px-84">
                {' '}
                <CustomBarChart
                  data={receivingCountriesChartData}
                  xKey="receiving_country"
                  yKey="total_cases"
                  title={`Top Receiving Countries (${
                    selectedYear === 'all' ? 'All Years' : selectedYear
                  })`}
                />
              </div>
              <div className="w-full xl:px-16 2xl:px-24 3xl:px-36 4xl:px-48 5xl:px-84">
                {' '}
                <CustomBarChart
                  data={usStatesChartData}
                  xKey="state"
                  yKey="total_cases"
                  title={`Top U.S. States of Origin (${
                    selectedYear === 'all' ? 'All Years' : selectedYear
                  })`}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OutgoingAdoptions;

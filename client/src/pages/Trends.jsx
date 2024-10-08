import { useState, useEffect } from 'react';
import CustomLineChart from '../components/LineChart';
import {
  fetchAdoptionsByState,
  fetchIncomingAdoptions,
  fetchYears,
} from '../services/api';
import CountrySelection from '../components/CountrySelection';
import StateSelection from '../components/StateSelection';

const Trends = () => {
  const [stateData, setStateData] = useState([]);
  const [countryData, setCountryData] = useState([]);
  const [years, setYears] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const yearsResult = await fetchYears();
        setYears(yearsResult.data.sort((a, b) => a - b));

        const statePromises = yearsResult.data.map((year) =>
          fetchAdoptionsByState(year)
        );
        const countryPromises = yearsResult.data.map((year) =>
          fetchIncomingAdoptions(year)
        );

        const stateResults = await Promise.all(statePromises);
        const countryResults = await Promise.all(countryPromises);

        setStateData(stateResults);
        setCountryData(countryResults);
      } catch (error) {
        console.error('Error fetching initial data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  const getChartData = (data, selected, defaultLabel) => {
    let chartData = years.map((year, index) => {
      let adoptions;
      if (selected === defaultLabel) {
        adoptions = data[index].data.reduce(
          (sum, item) => sum + item.total_adoptions,
          0
        );
      } else {
        const yearData = data[index].data.find((d) =>
          defaultLabel === 'All Countries'
            ? d.country === selected
            : d.state === selected
        );
        adoptions = yearData ? yearData.total_adoptions : 0;
      }
      return { year, adoptions };
    });

    // Calculate percent change
    chartData = chartData.map((item, index, array) => {
      if (index === 0) {
        return { ...item, percentChange: null };
      }
      const previousAdoptions = array[index - 1].adoptions;
      const percentChange =
        previousAdoptions !== 0
          ? ((item.adoptions - previousAdoptions) / previousAdoptions) * 100
          : null;
      return { ...item, percentChange };
    });

    return chartData;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b  pt-16 flex items-center justify-center">
        <div className="text-center text-2xl font-semibold text-gray-600">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pt-16">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-center mb-12 text-blue-800 leading-tight">
          Intercountry Adoption Trends
        </h1>

        <div className="space-y-16">
          {/* Country Section */}
          <div className="flex flex-col md:flex-row md:space-x-8">
            <div className="w-full md:w-1/4 mb-4 md:mb-0">
              <CountrySelection
                onCountryChange={setSelectedCountry}
                initialCountry={selectedCountry}
                dropdownHeight={370}
              />
            </div>
            <div className="w-full md:w-3/4">
              <CustomLineChart
                data={getChartData(
                  countryData,
                  selectedCountry || 'All Countries',
                  'All Countries'
                )}
                xKey="year"
                yKey="adoptions"
                title={`Outgoing Adoptions from ${
                  selectedCountry || 'All Countries'
                } by Year`}
              />
            </div>
          </div>

          {/* State Section */}
          <div className="flex flex-col md:flex-row md:space-x-8">
            <div className="w-full md:w-1/4 mb-4 md:mb-12">
              <StateSelection
                onStateChange={setSelectedState}
                initialState={selectedState}
                dropdownHeight={370}
              />
            </div>
            <div className="w-full md:w-3/4 mt-12">
              <CustomLineChart
                data={getChartData(
                  stateData,
                  selectedState || 'All States',
                  'All States'
                )}
                xKey="year"
                yKey="adoptions"
                title={`Incoming Adoptions in ${
                  selectedState || 'All States'
                } by Year`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Trends;

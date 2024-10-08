const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error connecting to the database', err);
  } else {
    console.log('Connected to the database');
  }
});

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Intercountry Adoption Statistics API' });
});

// Get all years
app.get('/api/years', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT year FROM years ORDER BY year DESC'
    );
    const formattedResponse = {
      year: 'all',
      data: result.rows.map((row) => row.year),
    };
    res.json(formattedResponse);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred while fetching years' });
  }
});

// Get all states
app.get('/api/states', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT state_name FROM states ORDER BY state_name'
    );
    const formattedResponse = {
      year: 'all',
      data: result.rows.map((row) => row.state_name),
    };
    res.json(formattedResponse);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred while fetching states' });
  }
});

// Get all countries of origin
app.get('/api/countries', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT country_name FROM countries ORDER BY country_name'
    );
    const formattedResponse = {
      year: 'all',
      data: result.rows.map((row) => row.country_name),
    };
    res.json(formattedResponse);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: 'An error occurred while fetching countries' });
  }
});

// Get incoming adoptions by country of origin by year
// Table 1 (Intercountry Adoption Annual Report Travel.State.Gov)

app.get('/api/incoming-adoptions/:year', async (req, res) => {
  try {
    const { year } = req.params;

    let result;
    if (year === 'all') {
      // Handle the 'all' case
      result = await pool.query(
        `SELECT c.country_name, 
                SUM(ia.adoptions_finalized_abroad) as adoptions_finalized_abroad,
                SUM(ia.adoptions_to_be_finalized_in_us) as adoptions_to_be_finalized_in_us,
                SUM(ia.total_adoptions) as total_adoptions
         FROM incoming_adoptions ia
         JOIN countries c ON ia.country_id = c.country_id
         GROUP BY c.country_name
         ORDER BY SUM(ia.total_adoptions) DESC`
      );
    } else {
      // Handle specific year case (existing logic)
      result = await pool.query(
        `SELECT c.country_name, ia.adoptions_finalized_abroad, ia.adoptions_to_be_finalized_in_us, ia.total_adoptions
         FROM incoming_adoptions ia
         JOIN countries c ON ia.country_id = c.country_id
         JOIN years y ON ia.year_id = y.year_id
         WHERE y.year = $1
         ORDER BY ia.total_adoptions DESC`,
        [year]
      );
    }

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: 'No data found for the specified year' });
    }

    const formattedResponse = {
      year: year,
      data: result.rows.map((row) => ({
        country: row.country_name,
        adoptions_finalized_abroad: parseInt(row.adoptions_finalized_abroad),
        adoptions_to_be_finalized_in_us: parseInt(
          row.adoptions_to_be_finalized_in_us
        ),
        total_adoptions: parseInt(row.total_adoptions),
      })),
      total_adoptions: result.rows.reduce(
        (sum, row) => sum + parseInt(row.total_adoptions),
        0
      ),
    };

    res.json(formattedResponse);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: 'An error occurred while fetching incoming adoptions' });
  }
});

// Get outgoing adoptions by year
// Table 3 (Intercountry Adoption Annual Report Travel.State.Gov)
// Get outgoing adoptions by year
app.get('/api/outgoing-adoptions/:year', async (req, res) => {
  try {
    const { year } = req.params;
    let result;
    if (year === 'all') {
      result = await pool.query(`
        SELECT 
          oa.receiving_country, 
          s.state_name AS us_state,
          SUM(oa.number_of_cases) as total_cases
        FROM outgoing_adoptions oa
        JOIN states s ON oa.state_id = s.state_id
        GROUP BY oa.receiving_country, s.state_name
        ORDER BY oa.receiving_country, SUM(oa.number_of_cases) DESC
      `);
    } else {
      result = await pool.query(
        `
        SELECT 
          oa.receiving_country, 
          s.state_name AS us_state,
          SUM(oa.number_of_cases) as total_cases
        FROM outgoing_adoptions oa
        JOIN states s ON oa.state_id = s.state_id
        JOIN years y ON oa.year_id = y.year_id
        WHERE y.year = $1
        GROUP BY oa.receiving_country, s.state_name
        ORDER BY oa.receiving_country, SUM(oa.number_of_cases) DESC
      `,
        [year]
      );
    }

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: 'No data found for the specified year' });
    }

    // Process the data to group by receiving country and US state
    const processedData = result.rows.reduce((acc, row) => {
      if (!acc[row.receiving_country]) {
        acc[row.receiving_country] = {
          receiving_country: row.receiving_country,
          total_cases: 0,
          us_states: {},
        };
      }

      acc[row.receiving_country].total_cases += parseInt(row.total_cases);
      acc[row.receiving_country].us_states[row.us_state] = parseInt(
        row.total_cases
      );

      return acc;
    }, {});

    const formattedResponse = {
      year: year,
      data: Object.values(processedData),
      total_cases: Object.values(processedData).reduce(
        (sum, country) => sum + country.total_cases,
        0
      ),
    };

    res.json(formattedResponse);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: 'An error occurred while fetching outgoing adoptions' });
  }
});

// Get incoming adoptions by state for a specific year
// Table 2 (Intercountry Adoption Annual Report Travel.State.Gov)
app.get('/api/incoming-adoptions-by-state/:year', async (req, res) => {
  try {
    const { year } = req.params;
    let result;
    if (year === 'all') {
      result = await pool.query(
        `SELECT s.state_name, 
                SUM(iabs.adoptions_finalized_abroad) as adoptions_finalized_abroad,
                SUM(iabs.adoptions_to_be_finalized_in_us) as adoptions_to_be_finalized_in_us,
                SUM(iabs.total_adoptions) as total_adoptions
          FROM incoming_adoptions_by_state iabs
          JOIN states s ON iabs.state_id = s.state_id
          GROUP BY s.state_name
          ORDER BY SUM(iabs.total_adoptions) DESC`
      );
    } else {
      result = await pool.query(
        `SELECT s.state_name, iabs.adoptions_finalized_abroad, iabs.adoptions_to_be_finalized_in_us, iabs.total_adoptions
          FROM incoming_adoptions_by_state iabs
          JOIN states s ON iabs.state_id = s.state_id
          JOIN years y ON iabs.year_id = y.year_id
          WHERE y.year = $1
          ORDER BY iabs.total_adoptions DESC`,
        [year]
      );
    }
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: 'No data found for the specified year' });
    }
    const formattedResponse = {
      year: year,
      data: result.rows.map((row) => ({
        state: row.state_name,
        adoptions_finalized_abroad: parseInt(row.adoptions_finalized_abroad),
        adoptions_to_be_finalized_in_us: parseInt(
          row.adoptions_to_be_finalized_in_us
        ),
        total_adoptions: parseInt(row.total_adoptions),
      })),
      total_adoptions: result.rows.reduce(
        (sum, row) => sum + parseInt(row.total_adoptions),
        0
      ),
    };
    res.json(formattedResponse);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: 'An error occurred while fetching adoptions by state' });
  }
});

// Start server
app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});

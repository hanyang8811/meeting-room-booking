/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
/**
 *export default {
 *	async fetch(request, env, ctx): Promise<Response> {
 *		return new Response('Hello World!');
 *	},
 *} satisfies ExportedHandler<Env>;
 */
interface Env {
	DB: D1Database;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const method = request.method;

		try {
			// CORS headers for all responses
			const corsHeaders = {
				'Access-Control-Allow-Origin': '*', // Adjust this for production to your frontend domain
				'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type',
			};

			// Handle CORS preflight requests
			if (method === 'OPTIONS') {
				return new Response(null, { headers: corsHeaders });
			}

			// --- ROOMS API ---

			// GET /api/rooms - Get all rooms
			if (path === '/api/rooms' && method === 'GET') {
				const { results } = await env.DB.prepare('SELECT * FROM rooms').all();
				return Response.json(results, { headers: corsHeaders });
			}

			// GET /api/rooms/:id - Get a single room by ID
			if (path.match(/^\/api\/rooms\/\d+$/) && method === 'GET') {
				const id = parseInt(path.split('/')[3]);
				if (isNaN(id)) {
					return new Response('Invalid Room ID', { status: 400, headers: corsHeaders });
				}
				const { results } = await env.DB.prepare('SELECT * FROM rooms WHERE id = ?').bind(id).all();
				if (results.length === 0) {
					return new Response('Room not found', { status: 404, headers: corsHeaders });
				}
				return Response.json(results[0], { headers: corsHeaders });
			}

			// POST /api/rooms - Create a new room
			if (path === '/api/rooms' && method === 'POST') {
				const { name, capacity, description } = await request.json();
				if (!name || !capacity) {
					return new Response('Name and capacity are required', { status: 400, headers: corsHeaders });
				}
				const { success, error } = await env.DB.prepare(
					'INSERT INTO rooms (name, capacity, description) VALUES (?, ?, ?)'
				)
					.bind(name, capacity, description)
					.run();

				if (!success) {
					console.error('Failed to create room:', error);
					return new Response('Failed to create room', { status: 500, headers: corsHeaders });
				}
				return new Response('Room created successfully', { status: 201, headers: corsHeaders });
			}

			// PUT /api/rooms/:id - Update a room
			if (path.match(/^\/api\/rooms\/\d+$/) && method === 'PUT') {
				const id = parseInt(path.split('/')[3]);
				if (isNaN(id)) {
					return new Response('Invalid Room ID', { status: 400, headers: corsHeaders });
				}
				const { name, capacity, description } = await request.json();
				if (!name && !capacity && !description) {
					return new Response('No update data provided', { status: 400, headers: corsHeaders });
				}

				let query = 'UPDATE rooms SET';
				const bindings = [];
				const updates = [];

				if (name) {
					updates.push('name = ?');
					bindings.push(name);
				}
				if (capacity !== undefined) {
					updates.push('capacity = ?');
					bindings.push(capacity);
				}
				if (description !== undefined) {
					updates.push('description = ?');
					bindings.push(description);
				}

				if (updates.length === 0) {
					return new Response('No valid fields to update', { status: 400, headers: corsHeaders });
				}

				query += ' ' + updates.join(', ') + ' WHERE id = ?';
				bindings.push(id);

				const { success, error } = await env.DB.prepare(query).bind(...bindings).run();

				if (!success) {
					console.error('Failed to update room:', error);
					return new Response('Failed to update room', { status: 500, headers: corsHeaders });
				}
				return new Response('Room updated successfully', { status: 200, headers: corsHeaders });
			}

			// DELETE /api/rooms/:id - Delete a room
			if (path.match(/^\/api\/rooms\/\d+$/) && method === 'DELETE') {
				const id = parseInt(path.split('/')[3]);
				if (isNaN(id)) {
					return new Response('Invalid Room ID', { status: 400, headers: corsHeaders });
				}
				const { success, error } = await env.DB.prepare('DELETE FROM rooms WHERE id = ?').bind(id).run();
				if (!success) {
					console.error('Failed to delete room:', error);
					return new Response('Failed to delete room', { status: 500, headers: corsHeaders });
				}
				return new Response('Room deleted successfully', { status: 200, headers: corsHeaders });
			}

			// --- BOOKINGS API ---

			// GET /api/bookings - Get all bookings (optional: filter by room_id, date)
			if (path === '/api/bookings' && method === 'GET') {
				const roomId = url.searchParams.get('roomId');
				const date = url.searchParams.get('date'); // YYYY-MM-DD format

				let query = 'SELECT * FROM bookings';
				const bindings = [];
				const conditions = [];

				if (roomId) {
					conditions.push('room_id = ?');
					bindings.push(parseInt(roomId));
				}
				if (date) {
					// Assuming bookings' start_time and end_time are stored as ISO 8601 strings
					conditions.push('DATE(start_time) = ?');
					bindings.push(date);
				}

				if (conditions.length > 0) {
					query += ' WHERE ' + conditions.join(' AND ');
				}

				query += ' ORDER BY start_time ASC';

				const { results } = await env.DB.prepare(query).bind(...bindings).all();
				return Response.json(results, { headers: corsHeaders });
			}

			// GET /api/bookings/room/:roomId - Get bookings for a specific room
			if (path.match(/^\/api\/bookings\/room\/\d+$/) && method === 'GET') {
				const roomId = parseInt(path.split('/')[4]);
				if (isNaN(roomId)) {
					return new Response('Invalid Room ID', { status: 400, headers: corsHeaders });
				}
				const { results } = await env.DB.prepare('SELECT * FROM bookings WHERE room_id = ? ORDER BY start_time ASC')
					.bind(roomId)
					.all();
				return Response.json(results, { headers: corsHeaders });
			}


			// POST /api/bookings - Create a new booking
			if (path === '/api/bookings' && method === 'POST') {
				const { roomId, startTime, endTime, bookedBy } = await request.json();

				if (!roomId || !startTime || !endTime || !bookedBy) {
					return new Response('Room ID, start time, end time, and booked by are required', { status: 400, headers: corsHeaders });
				}

				// Basic validation for time format (e.g., ISO 8601)
				if (isNaN(new Date(startTime).getTime()) || isNaN(new Date(endTime).getTime())) {
					return new Response('Invalid start or end time format. Use ISO 8601.', { status: 400, headers: corsHeaders });
				}

				// Check for overlapping bookings for the same room
				const overlapCheck = await env.DB.prepare(
					`SELECT COUNT(*) as count FROM bookings
                     WHERE room_id = ?
                     AND (
                         (start_time < ? AND end_time > ?) OR -- new booking overlaps existing
                         (start_time >= ? AND start_time < ?) OR -- existing booking starts during new
                         (end_time > ? AND end_time <= ?) -- existing booking ends during new
                     )`
				)
					.bind(roomId, endTime, startTime, startTime, endTime, startTime, endTime)
					.all();

				if (overlapCheck.results[0].count > 0) {
					return new Response('Room is already booked for the requested time slot.', { status: 409, headers: corsHeaders });
				}

				const { success, error } = await env.DB.prepare(
					'INSERT INTO bookings (room_id, start_time, end_time, booked_by) VALUES (?, ?, ?, ?)'
				)
					.bind(roomId, startTime, endTime, bookedBy)
					.run();

				if (!success) {
					console.error('Failed to create booking:', error);
					return new Response('Failed to create booking', { status: 500, headers: corsHeaders });
				}
				return new Response('Booking created successfully', { status: 201, headers: corsHeaders });
			}

			// DELETE /api/bookings/:id - Delete a booking
			if (path.match(/^\/api\/bookings\/\d+$/) && method === 'DELETE') {
				const id = parseInt(path.split('/')[3]);
				if (isNaN(id)) {
					return new Response('Invalid Booking ID', { status: 400, headers: corsHeaders });
				}
				const { success, error } = await env.DB.prepare('DELETE FROM bookings WHERE id = ?').bind(id).run();
				if (!success) {
					console.error('Failed to delete booking:', error);
					return new Response('Failed to delete booking', { status: 500, headers: corsHeaders });
				}
				return new Response('Booking deleted successfully', { status: 200, headers: corsHeaders });
			}


			// Default response for unmatched routes
			return new Response('Not Found', { status: 404, headers: corsHeaders });

		} catch (error) {
			console.error('Error:', error);
			const corsHeaders = {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type',
			};
			if (error instanceof Error) {
				return new Response(`Error: ${error.message}`, { status: 500, headers: corsHeaders });
			}
			return new Response('Unknown server error', { status: 500, headers: corsHeaders });
		}
	},
};

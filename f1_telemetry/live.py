import asyncio
import json

import websockets


LIVE_QUEUE = None
loop = asyncio.get_event_loop()
_CONNECTIONS = 0


def enqueue(data):
    global LIVE_QUEUE

    if LIVE_QUEUE is None:
        return False

    loop.call_soon_threadsafe(LIVE_QUEUE.put_nowait, data)

    return True


async def consume_queue(websocket):
    global LIVE_QUEUE, _CONNECTIONS

    _CONNECTIONS += 1

    if LIVE_QUEUE is None:
        LIVE_QUEUE = asyncio.Queue()

    try:
        while True:
            try:
                data = await asyncio.wait_for(LIVE_QUEUE.get(), 0.5)
            except asyncio.TimeoutError:
                await websocket.ping()
                continue

            await websocket.send(json.dumps(data))

    except websockets.exceptions.ConnectionClosed:
        _CONNECTIONS -= 1

        if _CONNECTIONS == 0:
            LIVE_QUEUE = None
            print("Queue cleared")
        return


async def _serve(host="localhost", port=20775):
    async with websockets.serve(consume_queue, host, port):
        await asyncio.Future()  # run forever


def serve(host="localhost", port=20775):
    loop.run_until_complete(_serve(host, port))

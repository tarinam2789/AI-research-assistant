from channels.generic.websocket import AsyncJsonWebsocketConsumer


class ResearchConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.group = f"question_{self.scope['url_route']['kwargs']['question_id']}"
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group, self.channel_name)

    async def stream_event(self, event):
        await self.send_json(event["payload"])

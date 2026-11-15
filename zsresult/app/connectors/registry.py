
from app.connectors.base import BoardConnector


class BoardRegistry:
    """
    Manages registered educational board connectors.
    """

    def __init__(self):
        self._connectors: dict[str, BoardConnector] = {}

    def register(self, connector: BoardConnector):
        board_key = connector.board_name.strip().lower()

        if not board_key:
            raise ValueError("Board name cannot be empty.")

        if board_key in self._connectors:
            raise ValueError(
                f"Connector already registered: {board_key}"
            )

        self._connectors[board_key] = connector

    def get(self, board_name: str):
        return self._connectors.get(
            board_name.strip().lower()
        )

    def list_boards(self):
        return sorted(self._connectors.keys())


board_registry = BoardRegistry()

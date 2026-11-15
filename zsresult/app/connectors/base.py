
from abc import ABC, abstractmethod
from typing import Any


class BoardConnector(ABC):
    """
    Base class for authorized educational board integrations.
    """

    board_name: str = ""
    is_configured: bool = False

    @abstractmethod
    async def check_result(
        self,
        roll_number: str,
        exam_type: str,
        class_name: str,
        year: int
    ) -> dict[str, Any]:
        """
        Fetch a result only through an authorized board source.

        Never generate or guess student marks.
        """
        raise NotImplementedError

    def ensure_configured(self):
        if not self.is_configured:
            raise NotImplementedError(
                f"{self.board_name} connector is not configured."
            )

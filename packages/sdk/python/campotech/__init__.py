"""
CampoTech Python SDK
=====================

Official Python SDK for the CampoTech API.

Example:
    >>> from campotech import CampoTech
    >>>
    >>> client = CampoTech(api_key='ct_live_...')
    >>>
    >>> # List customers
    >>> customers = client.customers.list(limit=10)
    >>>
    >>> # Create a job
    >>> job = client.jobs.create(
    ...     customer_id='cust_...',
    ...     title='AC Repair',
    ...     service_type='repair'
    ... )
"""

from __future__ import annotations

import time
import json
from typing import (
    Any,
    Dict,
    List,
    Optional,
    TypeVar,
    Generic,
    Union,
)
from dataclasses import dataclass, field
from datetime import datetime
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


# =============================================================================
# TYPES
# =============================================================================

T = TypeVar('T')


@dataclass
class Pagination:
    """Pagination information."""
    has_more: bool
    next_cursor: Optional[str]
    limit: int


@dataclass
class PaginatedResponse(Generic[T]):
    """Paginated API response."""
    data: List[T]
    pagination: Pagination


@dataclass
class Address:
    """Address object."""
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


@dataclass
class LineItem:
    """Line item for jobs and invoices."""
    description: str
    quantity: float
    unit_price: float
    tax_rate: Optional[float] = None
    discount: Optional[float] = None


@dataclass
class Customer:
    """Customer resource."""
    id: str
    org_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[Address] = None
    status: str = 'active'
    tags: List[str] = field(default_factory=list)
    metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


@dataclass
class Job:
    """Job resource."""
    id: str
    org_id: str
    customer_id: str
    title: str
    service_type: str
    status: str = 'pending'
    description: Optional[str] = None
    priority: str = 'normal'
    scheduled_start: Optional[str] = None
    scheduled_end: Optional[str] = None
    address: Optional[Address] = None
    assigned_technician_id: Optional[str] = None
    line_items: Optional[List[LineItem]] = None
    total: float = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


@dataclass
class Invoice:
    """Invoice resource."""
    id: str
    org_id: str
    customer_id: str
    invoice_number: str
    status: str = 'draft'
    line_items: List[LineItem] = field(default_factory=list)
    subtotal: float = 0
    tax_total: float = 0
    total: float = 0
    amount_paid: float = 0
    amount_due: float = 0
    due_date: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


@dataclass
class Payment:
    """Payment resource."""
    id: str
    org_id: str
    customer_id: str
    amount: float
    currency: str
    status: str
    payment_method: str
    payment_date: str
    invoice_id: Optional[str] = None
    created_at: Optional[str] = None


@dataclass
class Webhook:
    """Webhook resource."""
    id: str
    url: str
    events: List[str]
    enabled: bool = True
    secret: Optional[str] = None
    last_delivery_at: Optional[str] = None
    last_delivery_status: Optional[str] = None
    created_at: Optional[str] = None


# =============================================================================
# EXCEPTIONS
# =============================================================================

class CampoTechError(Exception):
    """Base exception for CampoTech SDK."""

    def __init__(
        self,
        message: str,
        code: str = 'UNKNOWN_ERROR',
        status_code: int = 0,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details


class AuthenticationError(CampoTechError):
    """Authentication failed."""
    pass


class ValidationError(CampoTechError):
    """Input validation failed."""
    pass


class NotFoundError(CampoTechError):
    """Resource not found."""
    pass


class RateLimitError(CampoTechError):
    """Rate limit exceeded."""

    def __init__(self, message: str, retry_after: Optional[int] = None):
        super().__init__(message, 'RATE_LIMIT_EXCEEDED', 429)
        self.retry_after = retry_after


# =============================================================================
# HTTP CLIENT
# =============================================================================

class HttpClient:
    """HTTP client with retry and timeout handling."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        access_token: Optional[str] = None,
        base_url: str = 'https://api.campotech.com/v1',
        timeout: int = 30,
        max_retries: int = 3,
    ):
        self.api_key = api_key
        self.access_token = access_token
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout

        # Setup session with retry
        self.session = requests.Session()
        retry = Retry(
            total=max_retries,
            backoff_factor=1,
            status_forcelist=[500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry)
        self.session.mount('http://', adapter)
        self.session.mount('https://', adapter)

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'CampoTech-SDK-Python/1.0.0',
        }
        if self.api_key:
            headers['X-API-Key'] = self.api_key
        elif self.access_token:
            headers['Authorization'] = f'Bearer {self.access_token}'
        return headers

    def _handle_response(self, response: requests.Response) -> Dict[str, Any]:
        try:
            data = response.json()
        except json.JSONDecodeError:
            data = {'error': {'code': 'PARSE_ERROR', 'message': response.text}}

        if response.status_code >= 400:
            error = data.get('error', {})
            message = error.get('message', 'Request failed')
            code = error.get('code', 'UNKNOWN_ERROR')
            details = error.get('details')

            if response.status_code == 401:
                raise AuthenticationError(message, code, 401, details)
            elif response.status_code == 404:
                raise NotFoundError(message, code, 404, details)
            elif response.status_code == 422:
                raise ValidationError(message, code, 422, details)
            elif response.status_code == 429:
                retry_after = response.headers.get('Retry-After')
                raise RateLimitError(
                    message,
                    retry_after=int(retry_after) if retry_after else None
                )
            else:
                raise CampoTechError(message, code, response.status_code, details)

        return data

    def request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        url = f'{self.base_url}{path}'

        # Filter out None values from params
        if params:
            params = {k: v for k, v in params.items() if v is not None}

        response = self.session.request(
            method=method,
            url=url,
            headers=self._get_headers(),
            params=params,
            json=json_data,
            timeout=self.timeout,
        )

        return self._handle_response(response)

    def get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return self.request('GET', path, params=params)

    def post(
        self,
        path: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return self.request('POST', path, params=params, json_data=data)

    def patch(self, path: str, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.request('PATCH', path, json_data=data)

    def put(self, path: str, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.request('PUT', path, json_data=data)

    def delete(self, path: str) -> Dict[str, Any]:
        return self.request('DELETE', path)


# =============================================================================
# RESOURCES
# =============================================================================

class CustomersResource:
    """Customers API resource."""

    def __init__(self, http: HttpClient):
        self._http = http

    def list(
        self,
        cursor: Optional[str] = None,
        limit: int = 20,
        search: Optional[str] = None,
        status: Optional[str] = None,
        sort_by: str = 'created_at',
        sort_order: str = 'desc',
    ) -> PaginatedResponse[Customer]:
        """List customers."""
        response = self._http.get('/customers', {
            'cursor': cursor,
            'limit': limit,
            'search': search,
            'status': status,
            'sort_by': sort_by,
            'sort_order': sort_order,
        })
        return self._parse_paginated(response)

    def get(self, customer_id: str) -> Customer:
        """Get a customer by ID."""
        response = self._http.get(f'/customers/{customer_id}')
        return self._parse_customer(response['data'])

    def create(
        self,
        name: str,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        address: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Customer:
        """Create a new customer."""
        data = {'name': name}
        if email:
            data['email'] = email
        if phone:
            data['phone'] = phone
        if address:
            data['address'] = address
        if tags:
            data['tags'] = tags
        if metadata:
            data['metadata'] = metadata

        response = self._http.post('/customers', data)
        return self._parse_customer(response['data'])

    def update(self, customer_id: str, **kwargs) -> Customer:
        """Update a customer."""
        response = self._http.patch(f'/customers/{customer_id}', kwargs)
        return self._parse_customer(response['data'])

    def delete(self, customer_id: str) -> Dict[str, Any]:
        """Delete a customer."""
        return self._http.delete(f'/customers/{customer_id}')['data']

    def _parse_customer(self, data: Dict[str, Any]) -> Customer:
        address = None
        if data.get('address'):
            address = Address(**data['address'])
        return Customer(
            id=data['id'],
            org_id=data['org_id'],
            name=data['name'],
            email=data.get('email'),
            phone=data.get('phone'),
            address=address,
            status=data.get('status', 'active'),
            tags=data.get('tags', []),
            metadata=data.get('metadata'),
            created_at=data.get('created_at'),
            updated_at=data.get('updated_at'),
        )

    def _parse_paginated(self, response: Dict[str, Any]) -> PaginatedResponse[Customer]:
        pagination = Pagination(
            has_more=response['pagination']['has_more'],
            next_cursor=response['pagination'].get('next_cursor'),
            limit=response['pagination']['limit'],
        )
        customers = [self._parse_customer(c) for c in response['data']]
        return PaginatedResponse(data=customers, pagination=pagination)


class JobsResource:
    """Jobs API resource."""

    def __init__(self, http: HttpClient):
        self._http = http

    def list(
        self,
        cursor: Optional[str] = None,
        limit: int = 20,
        customer_id: Optional[str] = None,
        technician_id: Optional[str] = None,
        status: Optional[Union[str, List[str]]] = None,
        priority: Optional[Union[str, List[str]]] = None,
        scheduled_after: Optional[str] = None,
        scheduled_before: Optional[str] = None,
    ) -> PaginatedResponse[Job]:
        """List jobs."""
        response = self._http.get('/jobs', {
            'cursor': cursor,
            'limit': limit,
            'customer_id': customer_id,
            'technician_id': technician_id,
            'status': status,
            'priority': priority,
            'scheduled_after': scheduled_after,
            'scheduled_before': scheduled_before,
        })
        return self._parse_paginated(response)

    def get(self, job_id: str) -> Job:
        """Get a job by ID."""
        response = self._http.get(f'/jobs/{job_id}')
        return self._parse_job(response['data'])

    def create(
        self,
        customer_id: str,
        title: str,
        service_type: str,
        **kwargs
    ) -> Job:
        """Create a new job."""
        data = {
            'customer_id': customer_id,
            'title': title,
            'service_type': service_type,
            **kwargs,
        }
        response = self._http.post('/jobs', data)
        return self._parse_job(response['data'])

    def update(self, job_id: str, **kwargs) -> Job:
        """Update a job."""
        response = self._http.patch(f'/jobs/{job_id}', kwargs)
        return self._parse_job(response['data'])

    def delete(self, job_id: str) -> Dict[str, Any]:
        """Delete a job."""
        return self._http.delete(f'/jobs/{job_id}')['data']

    def assign(self, job_id: str, technician_id: str) -> Job:
        """Assign a technician to a job."""
        response = self._http.post(
            f'/jobs/{job_id}/assign',
            {'technician_id': technician_id}
        )
        return self._parse_job(response['data'])

    def schedule(
        self,
        job_id: str,
        scheduled_start: str,
        scheduled_end: Optional[str] = None,
    ) -> Job:
        """Schedule a job."""
        response = self._http.post(
            f'/jobs/{job_id}/schedule',
            {'scheduled_start': scheduled_start, 'scheduled_end': scheduled_end}
        )
        return self._parse_job(response['data'])

    def start(self, job_id: str) -> Job:
        """Start a job."""
        response = self._http.post(f'/jobs/{job_id}/start')
        return self._parse_job(response['data'])

    def complete(
        self,
        job_id: str,
        completion_notes: Optional[str] = None,
        line_items: Optional[List[Dict[str, Any]]] = None,
    ) -> Job:
        """Complete a job."""
        data = {}
        if completion_notes:
            data['completion_notes'] = completion_notes
        if line_items:
            data['line_items'] = line_items
        response = self._http.post(f'/jobs/{job_id}/complete', data or None)
        return self._parse_job(response['data'])

    def cancel(self, job_id: str, reason: str) -> Job:
        """Cancel a job."""
        response = self._http.post(f'/jobs/{job_id}/cancel', {'reason': reason})
        return self._parse_job(response['data'])

    def _parse_job(self, data: Dict[str, Any]) -> Job:
        address = None
        if data.get('address'):
            address = Address(**data['address'])
        return Job(
            id=data['id'],
            org_id=data['org_id'],
            customer_id=data['customer_id'],
            title=data['title'],
            service_type=data['service_type'],
            status=data.get('status', 'pending'),
            description=data.get('description'),
            priority=data.get('priority', 'normal'),
            scheduled_start=data.get('scheduled_start'),
            scheduled_end=data.get('scheduled_end'),
            address=address,
            assigned_technician_id=data.get('assigned_technician_id'),
            total=data.get('total', 0),
            created_at=data.get('created_at'),
            updated_at=data.get('updated_at'),
        )

    def _parse_paginated(self, response: Dict[str, Any]) -> PaginatedResponse[Job]:
        pagination = Pagination(
            has_more=response['pagination']['has_more'],
            next_cursor=response['pagination'].get('next_cursor'),
            limit=response['pagination']['limit'],
        )
        jobs = [self._parse_job(j) for j in response['data']]
        return PaginatedResponse(data=jobs, pagination=pagination)


class InvoicesResource:
    """Invoices API resource."""

    def __init__(self, http: HttpClient):
        self._http = http

    def list(
        self,
        cursor: Optional[str] = None,
        limit: int = 20,
        customer_id: Optional[str] = None,
        status: Optional[Union[str, List[str]]] = None,
    ) -> PaginatedResponse[Invoice]:
        """List invoices."""
        response = self._http.get('/invoices', {
            'cursor': cursor,
            'limit': limit,
            'customer_id': customer_id,
            'status': status,
        })
        # Simplified parsing
        pagination = Pagination(
            has_more=response['pagination']['has_more'],
            next_cursor=response['pagination'].get('next_cursor'),
            limit=response['pagination']['limit'],
        )
        return PaginatedResponse(data=response['data'], pagination=pagination)

    def get(self, invoice_id: str) -> Invoice:
        """Get an invoice by ID."""
        response = self._http.get(f'/invoices/{invoice_id}')
        return response['data']

    def create(
        self,
        customer_id: str,
        line_items: List[Dict[str, Any]],
        **kwargs
    ) -> Invoice:
        """Create a new invoice."""
        data = {
            'customer_id': customer_id,
            'line_items': line_items,
            **kwargs,
        }
        response = self._http.post('/invoices', data)
        return response['data']

    def send(
        self,
        invoice_id: str,
        email: Optional[str] = None,
        message: Optional[str] = None,
    ) -> Invoice:
        """Send an invoice."""
        data = {}
        if email:
            data['email'] = email
        if message:
            data['message'] = message
        response = self._http.post(f'/invoices/{invoice_id}/send', data or None)
        return response['data']

    def record_payment(
        self,
        invoice_id: str,
        amount: float,
        payment_method: str,
        **kwargs
    ) -> Invoice:
        """Record a payment on an invoice."""
        data = {
            'amount': amount,
            'payment_method': payment_method,
            **kwargs,
        }
        response = self._http.post(f'/invoices/{invoice_id}/payments', data)
        return response['data']


class PaymentsResource:
    """Payments API resource."""

    def __init__(self, http: HttpClient):
        self._http = http

    def list(
        self,
        cursor: Optional[str] = None,
        limit: int = 20,
        customer_id: Optional[str] = None,
        invoice_id: Optional[str] = None,
    ) -> PaginatedResponse[Payment]:
        """List payments."""
        response = self._http.get('/payments', {
            'cursor': cursor,
            'limit': limit,
            'customer_id': customer_id,
            'invoice_id': invoice_id,
        })
        pagination = Pagination(
            has_more=response['pagination']['has_more'],
            next_cursor=response['pagination'].get('next_cursor'),
            limit=response['pagination']['limit'],
        )
        return PaginatedResponse(data=response['data'], pagination=pagination)

    def get(self, payment_id: str) -> Payment:
        """Get a payment by ID."""
        response = self._http.get(f'/payments/{payment_id}')
        return response['data']

    def create(
        self,
        customer_id: str,
        amount: float,
        payment_method: str,
        **kwargs
    ) -> Payment:
        """Create a payment."""
        data = {
            'customer_id': customer_id,
            'amount': amount,
            'payment_method': payment_method,
            **kwargs,
        }
        response = self._http.post('/payments', data)
        return response['data']

    def refund(
        self,
        payment_id: str,
        reason: str,
        amount: Optional[float] = None,
    ) -> Payment:
        """Refund a payment."""
        data = {'reason': reason}
        if amount:
            data['amount'] = amount
        response = self._http.post(f'/payments/{payment_id}/refund', data)
        return response['data']


class WebhooksResource:
    """Webhooks API resource."""

    def __init__(self, http: HttpClient):
        self._http = http

    def list(self, cursor: Optional[str] = None, limit: int = 20) -> PaginatedResponse[Webhook]:
        """List webhooks."""
        response = self._http.get('/webhooks', {'cursor': cursor, 'limit': limit})
        pagination = Pagination(
            has_more=response['pagination']['has_more'],
            next_cursor=response['pagination'].get('next_cursor'),
            limit=response['pagination']['limit'],
        )
        return PaginatedResponse(data=response['data'], pagination=pagination)

    def get(self, webhook_id: str) -> Webhook:
        """Get a webhook by ID."""
        response = self._http.get(f'/webhooks/{webhook_id}')
        return response['data']

    def create(
        self,
        url: str,
        events: List[str],
        description: Optional[str] = None,
    ) -> Webhook:
        """Create a webhook."""
        data = {'url': url, 'events': events}
        if description:
            data['description'] = description
        response = self._http.post('/webhooks', data)
        return response['data']

    def update(self, webhook_id: str, **kwargs) -> Webhook:
        """Update a webhook."""
        response = self._http.patch(f'/webhooks/{webhook_id}', kwargs)
        return response['data']

    def delete(self, webhook_id: str) -> Dict[str, Any]:
        """Delete a webhook."""
        return self._http.delete(f'/webhooks/{webhook_id}')['data']

    def test(self, webhook_id: str, event_type: str) -> Dict[str, Any]:
        """Test a webhook."""
        response = self._http.post(
            f'/webhooks/{webhook_id}/test',
            {'event_type': event_type}
        )
        return response['data']


# =============================================================================
# MAIN CLIENT
# =============================================================================

class CampoTech:
    """
    CampoTech API client.

    Args:
        api_key: API key for authentication.
        access_token: OAuth access token (alternative to api_key).
        base_url: Base URL for the API (default: production).
        timeout: Request timeout in seconds.
        max_retries: Maximum number of retries for failed requests.

    Example:
        >>> client = CampoTech(api_key='ct_live_...')
        >>> customers = client.customers.list()
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        access_token: Optional[str] = None,
        base_url: str = 'https://api.campotech.com/v1',
        timeout: int = 30,
        max_retries: int = 3,
    ):
        if not api_key and not access_token:
            raise ValueError('Either api_key or access_token is required')

        self._http = HttpClient(
            api_key=api_key,
            access_token=access_token,
            base_url=base_url,
            timeout=timeout,
            max_retries=max_retries,
        )

        self.customers = CustomersResource(self._http)
        self.jobs = JobsResource(self._http)
        self.invoices = InvoicesResource(self._http)
        self.payments = PaymentsResource(self._http)
        self.webhooks = WebhooksResource(self._http)


# Convenience alias
Client = CampoTech

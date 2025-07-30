'use client';

import { useEffect, useState } from 'react';
import { TillManagement } from '@/components/pos/till-management';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { drawerService } from '@/services/drawer.service';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeftIcon } from '@/components/icons';
import { useRouter } from 'next/navigation';
import Header from '@/components/header/header';

export default function TillPage() {
  const [sessionHistory, setSessionHistory] = useState<any[]>([]);
  const [drawerLogs, setDrawerLogs] = useState<any[]>([]);
  const [transactionHistory, setTransactionHistory] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [allTransactionsPagination, setAllTransactionsPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    hasMore: false,
    totalCount: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAllTransactions, setIsLoadingAllTransactions] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const router = useRouter();

  const toggleSessionExpansion = (sessionId: string) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
    } else {
      newExpanded.add(sessionId);
    }
    setExpandedSessions(newExpanded);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const history = await drawerService.getSessionHistory(20);
      setSessionHistory(history || []);

      const logsResponse = await drawerService.getLogs(50);
      setDrawerLogs(logsResponse.logs || []);

      const transactionsResponse = await drawerService.getTransactionHistory(50);
      setTransactionHistory(transactionsResponse.transactions || []);

      // Fetch initial all transactions data
      await fetchAllTransactions(1);
    } catch (error) {
      console.error('Error fetching till data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllTransactions = async (page: number = 1) => {
    setIsLoadingAllTransactions(true);
    try {
      const limit = 5; // Show 5 sessions per page
      const offset = (page - 1) * limit;

      const response = await drawerService.getAllTransactions(limit, offset);
      setAllTransactions(response.sessions);
      setAllTransactionsPagination({
        currentPage: response.currentPage,
        totalPages: response.totalPages,
        hasMore: response.hasMore,
        totalCount: response.totalCount
      });
    } catch (error) {
      console.error('Error fetching all transactions:', error);
    } finally {
      setIsLoadingAllTransactions(false);
    }
  };

  const getOperationTypeLabel = (type: string) => {
    switch (type) {
      case 'OPENING_BALANCE':
        return <Badge variant="outline" className="bg-green-100">Opening Balance</Badge>;
      case 'OPEN':
        return <Badge variant="outline" className="bg-green-100">Open</Badge>;
      case 'CLOSE':
        return <Badge variant="outline" className="bg-red-100">Close</Badge>;
      case 'ADD_CASH':
        return <Badge variant="outline" className="bg-blue-100">Add Cash</Badge>;
      case 'TAKE_CASH':
        return <Badge variant="outline" className="bg-yellow-100">Take Cash</Badge>;
      case 'SALE':
        return <Badge variant="outline" className="bg-blue-100">Cash Sale</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="w-full space-y-6">
      <Header />
      <div className="flex justify-between items-center px-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => router.push('/pos')}
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to POS
          </Button>
          <h1 className="text-3xl font-bold">Till Management</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 px-6">
        <div className="md:col-span-2">
          <TillManagement onSessionChange={fetchData} />
        </div>

        <div className="md:col-span-3">
          <Tabs defaultValue="sessions">
            <TabsList className="mb-4">
              <TabsTrigger value="sessions">Session History</TabsTrigger>
              <TabsTrigger value="transactions">Session Transactions</TabsTrigger>
              <TabsTrigger value="operations">Session Operations Log</TabsTrigger>
              <TabsTrigger value="all-transactions">All Transactions</TabsTrigger>
            </TabsList>

            <TabsContent value="sessions">
              <Card>
                <CardHeader>
                  <CardTitle>Till Session History</CardTitle>
                  <CardDescription>
                    Recent till opening and closing sessions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8">Loading session history...</div>
                  ) : sessionHistory.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Opening Amount</TableHead>
                          <TableHead>Closing Amount</TableHead>
                          <TableHead>Difference</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sessionHistory.map((session) => {
                          const difference = session.closingAmount && session.openingAmount
                            ? parseFloat(session.closingAmount) - parseFloat(session.openingAmount)
                            : null;

                          return (
                            <TableRow key={session.id}>
                              <TableCell>
                                {formatDate(session.openedAt || session.createdAt)}
                                {session.closedAt && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Closed: {formatDate(session.closedAt)}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                {session.user ? (
                                  <span>{session.user.firstName} {session.user.lastName}</span>
                                ) : (
                                  <span className="text-gray-500">Unknown</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {session.status === 'OPEN' ? (
                                  <Badge variant="success">Open</Badge>
                                ) : (
                                  <Badge variant="secondary">Closed</Badge>
                                )}
                              </TableCell>
                              <TableCell>{formatCurrency(parseFloat(session.openingAmount))}</TableCell>
                              <TableCell>
                                {session.closingAmount ? formatCurrency(parseFloat(session.closingAmount)) : '-'}
                              </TableCell>
                              <TableCell>
                                {difference !== null ? (
                                  <span className={difference >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    {formatCurrency(difference)}
                                  </span>
                                ) : '-'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No session history found
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transactions">
              <Card>
                <CardHeader>
                  <CardTitle>Till Transaction History</CardTitle>
                  <CardDescription>
                    Recent transactions in the current drawer session
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8">Loading transaction history...</div>
                  ) : transactionHistory.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Note</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactionHistory.map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell>{new Date(transaction.createdAt).toLocaleString()}</TableCell>
                            <TableCell>
                              {transaction.type === 'ADD' || transaction.type === 'ADD_CASH' ? (
                                <Badge variant="outline" className="bg-green-100 text-green-800">Pay In</Badge>
                              ) : transaction.type === 'REMOVE' || transaction.type === 'TAKE_CASH' ? (
                                <Badge variant="outline" className="bg-red-100 text-red-800">Pay Out</Badge>
                              ) : transaction.type === 'SALE' ? (
                                <Badge variant="outline" className="bg-blue-100 text-blue-800">Cash Sale</Badge>
                              ) : (
                                <Badge variant="outline">{transaction.type}</Badge>
                              )}
                            </TableCell>
                            <TableCell className={transaction.type === 'ADD' || transaction.type === 'ADD_CASH' || transaction.type === 'SALE' || transaction.type === 'OPENING_BALANCE' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                              {transaction.type === 'ADD' || transaction.type === 'ADD_CASH' || transaction.type === 'SALE' || transaction.type === 'OPENING_BALANCE' ? '+' : '-'}{formatCurrency(transaction.amount)}
                            </TableCell>
                            <TableCell className="max-w-sm break-words">{transaction.notes || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No transactions found
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="operations">
              <Card>
                <CardHeader>
                  <CardTitle>Till Operations Log</CardTitle>
                  <CardDescription>
                    Recent cash drawer operations and events
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8">Loading operations log...</div>
                  ) : drawerLogs.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {drawerLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                log.action === 'OPEN_SESSION' ? 'bg-green-100 text-green-800' :
                                  log.action === 'CLOSE_SESSION' ? 'bg-red-100 text-red-800' :
                                    log.action === 'ADD_CASH' ? 'bg-blue-100 text-blue-800' :
                                      log.action === 'REMOVE_CASH' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-gray-100 text-gray-800'
                              }>
                                {log.action.split('_').map((word: string) => word.charAt(0) + word.slice(1).toLowerCase()).join(' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Unknown'}
                            </TableCell>
                            <TableCell>
                              {log.amount ? formatCurrency(log.amount) : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={log.success ? 'success' : 'destructive'}>
                                {log.success ? 'Success' : 'Failed'}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-sm break-words">
                              {log.error || log.deviceInfo || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No operations found
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="all-transactions">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>All Till Transactions</CardTitle>
                      <CardDescription>
                        Complete transaction history organized by till sessions
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchAllTransactions(1)}
                      disabled={isLoadingAllTransactions}
                    >
                      {isLoadingAllTransactions ? 'Refreshing...' : 'Refresh'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingAllTransactions ? (
                    <div className="text-center py-8">Loading all transactions...</div>
                  ) : allTransactions.length > 0 ? (
                    <div className="space-y-6">
                      {allTransactions.map((session) => (
                        <div key={session.id} className="border rounded-lg p-4 space-y-4">
                          {/* Session Header */}
                          <div className="flex justify-between items-start border-b pb-3">
                            <div>
                              <h3 className="font-semibold text-lg">
                                Session #{session.id.slice(-8)}
                              </h3>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <p>Opened: {formatDate(session.openedAt)} by {session.user ? `${session.user.firstName} ${session.user.lastName}` : 'Unknown'}</p>
                                {session.closedAt && (
                                  <p>Closed: {formatDate(session.closedAt)}</p>
                                )}
                                <p>Opening Amount: {formatCurrency(parseFloat(session.openingAmount))}</p>
                                {session.closingAmount && (
                                  <p>Closing Amount: {formatCurrency(parseFloat(session.closingAmount))}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right space-y-2">
                              <Badge variant={session.status === 'OPEN' ? 'success' : 'secondary'}>
                                {session.status}
                              </Badge>
                              <div className="text-sm text-muted-foreground">
                                <p>{session.operations.length} operations</p>
                                {session.payments && <p>{session.payments.length} payments</p>}
                              </div>
                              {session.paymentTotals && (
                                <div className="text-xs space-y-1">
                                  <p className="font-medium">Payment Totals:</p>
                                  {Object.entries(session.paymentTotals).map(([method, amount]) => {
                                    const numAmount = Number(amount);
                                    return numAmount > 0 && (
                                      <p key={method} className="text-muted-foreground">
                                        {method}: {formatCurrency(numAmount)}
                                      </p>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Session Summary */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-gray-50 rounded-lg">
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground">Total Operations</p>
                              <p className="font-semibold">{session.operations.length}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground">Total Payments</p>
                              <p className="font-semibold">{session.payments ? session.payments.length : 0}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground">Cash Total</p>
                              <p className="font-semibold text-green-600">
                                {session.paymentTotals ? formatCurrency(session.paymentTotals.CASH || 0) : formatCurrency(0)}
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground">Card Total</p>
                              <p className="font-semibold text-blue-600">
                                {session.paymentTotals ? formatCurrency(session.paymentTotals.CARD || 0) : formatCurrency(0)}
                              </p>
                            </div>
                          </div>

                          {/* Operations Table */}
                          {session.operations.length > 0 && (
                            <div>
                              <div className="flex justify-between items-center mb-2">
                                <h4 className="font-medium">Operations ({session.operations.length})</h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleSessionExpansion(session.id)}
                                >
                                  {expandedSessions.has(session.id) ? 'Hide Details' : 'Show Details'}
                                </Button>
                              </div>
                              {expandedSessions.has(session.id) && (
                                <>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead>Notes</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {session.operations.map((operation: any) => (
                                        <TableRow key={operation.id}>
                                          <TableCell className="text-sm">
                                            {new Date(operation.createdAt).toLocaleTimeString()}
                                          </TableCell>
                                          <TableCell>
                                            <Badge variant="outline" className={
                                              operation.type === 'OPENING_BALANCE' ? 'bg-green-100' :
                                                operation.type === 'CLOSING_BALANCE' ? 'bg-red-100' :
                                                  operation.type === 'ADD_CASH' ? 'bg-blue-100' :
                                                    operation.type === 'TAKE_CASH' ? 'bg-yellow-100' :
                                                      operation.type === 'SALE' ? 'bg-purple-100' :
                                                        'bg-gray-100'
                                            }>
                                              {operation.type.replace('_', ' ')}
                                            </Badge>
                                          </TableCell>
                                          <TableCell className={
                                            operation.type === 'ADD_CASH' || operation.type === 'SALE' || operation.type === 'OPENING_BALANCE'
                                              ? 'text-green-600 font-medium'
                                              : 'text-red-600 font-medium'
                                          }>
                                            {operation.type === 'ADD_CASH' || operation.type === 'SALE' || operation.type === 'OPENING_BALANCE' ? '+' : '-'}
                                            {formatCurrency(Math.abs(parseFloat(operation.amount)))}
                                          </TableCell>
                                          <TableCell className="text-sm">
                                            {operation.user ? `${operation.user.firstName} ${operation.user.lastName}` : 'Unknown'}
                                          </TableCell>
                                          <TableCell className="text-sm max-w-sm break-words">
                                            {operation.notes || '-'}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Pagination */}
                      <div className="flex justify-between items-center pt-4">
                        <div className="text-sm text-muted-foreground">
                          Showing {allTransactions.length} of {allTransactionsPagination.totalCount} sessions
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchAllTransactions(allTransactionsPagination.currentPage - 1)}
                            disabled={allTransactionsPagination.currentPage <= 1 || isLoadingAllTransactions}
                          >
                            Previous
                          </Button>
                          <span className="px-3 py-1 text-sm">
                            Page {allTransactionsPagination.currentPage} of {allTransactionsPagination.totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchAllTransactions(allTransactionsPagination.currentPage + 1)}
                            disabled={!allTransactionsPagination.hasMore || isLoadingAllTransactions}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No transactions found
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

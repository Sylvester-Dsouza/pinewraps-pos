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
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

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
    } catch (error) {
      console.error('Error fetching till data:', error);
    } finally {
      setIsLoading(false);
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
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="operations">Operations Log</TabsTrigger>
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
                          <TableHead>Status</TableHead>
                          <TableHead>Opening Amount</TableHead>
                          <TableHead>Closing Amount</TableHead>
                          <TableHead>Difference</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sessionHistory.map((session) => {
                          const difference = session.closingAmount && session.openingAmount
                            ? session.closingAmount - session.openingAmount
                            : null;

                          return (
                            <TableRow key={session.id}>
                              <TableCell>{formatDate(session.createdAt)}</TableCell>
                              <TableCell>
                                {session.status === 'OPEN' ? (
                                  <Badge variant="success">Open</Badge>
                                ) : (
                                  <Badge variant="secondary">Closed</Badge>
                                )}
                              </TableCell>
                              <TableCell>{formatCurrency(session.openingAmount)}</TableCell>
                              <TableCell>
                                {session.closingAmount ? formatCurrency(session.closingAmount) : '-'}
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
                            <TableCell className={transaction.type === 'ADD' || transaction.type === 'ADD_CASH' || transaction.type === 'SALE' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                              {transaction.type === 'ADD' || transaction.type === 'ADD_CASH' || transaction.type === 'SALE' ? '+' : '-'}{formatCurrency(transaction.amount)}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">{transaction.notes || '-'}</TableCell>
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
                                {log.action.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ')}
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
                            <TableCell className="max-w-xs truncate">
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
          </Tabs>
        </div>
      </div>
    </div>
  );
}
